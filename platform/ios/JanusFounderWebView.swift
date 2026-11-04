import Foundation
import SwiftUI
import WebKit

/// Same JANUS web app and authority. This adds the existing Secure Enclave signer
/// to an iPhone host; it does not create a second backend or store session tokens.
@available(iOS 15.0, *)
public struct JanusFounderWebView: UIViewRepresentable {
    public let baseURL: URL
    public let keyId: String

    public init(baseURL: URL, keyId: String = "founder-iphone-01-v1") {
        self.baseURL = baseURL
        self.keyId = keyId
    }

    public func makeCoordinator() -> Coordinator { Coordinator(baseURL: baseURL, keyId: keyId) }

    public func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "janusFounder")
        configuration.userContentController.addUserScript(WKUserScript(source: """
        window.JanusFounderNative = Object.freeze({
          actionProof: input => window.webkit.messageHandlers.janusFounder.postMessage({
            operation: 'proof', action: input.action, authoritySessionToken: input.authoritySessionToken
          }),
          enroll: input => window.webkit.messageHandlers.janusFounder.postMessage({
            operation: 'enroll', authoritySessionToken: input.authoritySessionToken
          })
        });
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        if context.coordinator.client != nil {
            webView.load(URLRequest(url: baseURL.appendingPathComponent("dashboard/a")))
        }
        return webView
    }

    public func updateUIView(_ uiView: WKWebView, context: Context) {}

    public final class Coordinator: NSObject, WKScriptMessageHandlerWithReply, WKNavigationDelegate {
        fileprivate let client: JanusFounderBiometricClient?
        private let origin: URL
        private let keyId: String

        init(baseURL: URL, keyId: String) {
            self.origin = baseURL
            self.keyId = keyId
            self.client = try? JanusFounderBiometricClient(baseURL: baseURL)
        }

        private func isTrusted(_ url: URL?) -> Bool {
            guard let url else { return false }
            return url.scheme == origin.scheme && url.host == origin.host && url.port == origin.port
        }

        public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            // The privileged host never loads a different origin.
            decisionHandler(isTrusted(navigationAction.request.url) ? .allow : .cancel)
        }

        public func userContentController(_ userContentController: WKUserContentController,
                                          didReceive message: WKScriptMessage,
                                          replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame, isTrusted(message.frameInfo.request.url),
                  let client, let body = message.body as? [String: Any],
                  let token = body["authoritySessionToken"] as? String, !token.isEmpty,
                  let operation = body["operation"] as? String else {
                replyHandler(nil, "Se requiere la sesión del Founder en el origen de JANUS.")
                return
            }
            Task { @MainActor in
                do {
                    if operation == "enroll" {
                        let result = try await client.enroll(authoritySessionToken: token, newKeyId: self.keyId)
                        replyHandler(result, nil)
                    } else if operation == "proof", let action = body["action"] as? String,
                              ["knowledge.change.apply", "knowledge.snapshot.publish"].contains(action) {
                        let proof = try await client.actionProof(authoritySessionToken: token, action: action,
                            keyId: self.keyId, reason: "Confirma el cambio que revisaste en JANUS")
                        replyHandler(proof, nil)
                    } else {
                        replyHandler(nil, "Acción no admitida por el puente de JANUS.")
                    }
                } catch {
                    replyHandler(nil, error.localizedDescription)
                }
            }
        }
    }
}
