import Foundation

public enum JanusFounderBiometricClientError: LocalizedError {
    case insecureBaseURL
    case invalidResponse
    case http(Int, String)
    case missingField(String)
    case existingKeyRequired

    public var errorDescription: String? {
        switch self {
        case .insecureBaseURL:
            return "Janus biometric transport must use HTTPS (loopback HTTP is allowed only for local development)."
        case .invalidResponse:
            return "Janus returned an invalid biometric response."
        case .http(let status, let message):
            return "Janus biometric request failed (HTTP \(status)): \(message)"
        case .missingField(let field):
            return "Janus biometric response is missing \(field)."
        case .existingKeyRequired:
            return "An existing enrolled Founder Face ID key is required to authorize rotation."
        }
    }
}

/// Thin iPhone client for the JANUS CORE biometric enrollment/action-proof API.
///
/// The authority bearer token is accepted per call and is never persisted by
/// this class. The Secure Enclave private key is owned by Security.framework.
public final class JanusFounderBiometricClient {
    private let baseURL: URL
    private let session: URLSession
    private let signer: JanusFounderFaceSigner

    public init(
        baseURL: URL,
        session: URLSession = .shared,
        signer: JanusFounderFaceSigner = JanusFounderFaceSigner()
    ) throws {
        guard Self.isAllowedBaseURL(baseURL) else {
            throw JanusFounderBiometricClientError.insecureBaseURL
        }
        self.baseURL = baseURL
        self.session = session
        self.signer = signer
    }

    /// Enrolls a new Secure Enclave Face ID key.
    ///
    /// For first enrollment, Founder authority + new-key proof-of-possession are
    /// sufficient. For rotation, JANUS CORE additionally requires a fresh proof
    /// from an already-enrolled Face ID key.
    public func enroll(
        authoritySessionToken: String,
        newKeyId: String,
        existingKeyIdForRotation: String? = nil
    ) async throws -> [String: Any] {
        let descriptor = try signer.createKeyIfNeeded(keyId: newKeyId)

        let challengeResponse = try await postJSON(
            path: "/api/auth/biometric/enrollment/challenge",
            authoritySessionToken: authoritySessionToken,
            body: [
                "keyId": newKeyId,
                "publicKeyPem": descriptor.publicKeyPEM,
            ]
        )

        let challenge = try dictionary(challengeResponse["challenge"], "challenge")
        let challengeId = try string(challenge["id"], "challenge.id")
        let signingPayload = try string(
            challenge["signingPayload"],
            "challenge.signingPayload"
        )
        let requiresExistingProof = challengeResponse["requiresExistingProof"] as? Bool ?? false

        let enrollmentSignature = try await signer.sign(
            payload: signingPayload,
            keyId: newKeyId,
            reason: "Enroll this iPhone as a Founder Face ID key for Janus"
        )

        var proofId: String?
        if requiresExistingProof {
            guard let existingKeyIdForRotation else {
                throw JanusFounderBiometricClientError.existingKeyRequired
            }
            proofId = try await actionProof(
                authoritySessionToken: authoritySessionToken,
                action: "security.biometric.enroll",
                keyId: existingKeyIdForRotation,
                reason: "Authorize a new Founder Face ID key"
            )
        }

        return try await postJSON(
            path: "/api/auth/biometric/enroll",
            authoritySessionToken: authoritySessionToken,
            extraHeaders: proofId.map { ["x-janus-biometric-proof": $0] } ?? [:],
            body: [
                "confirmAction": "enroll_founder_face_key",
                "challengeId": challengeId,
                "keyId": newKeyId,
                "publicKeyPem": descriptor.publicKeyPEM,
                "signature": enrollmentSignature,
            ]
        )
    }

    /// Produces a one-time JANUS CORE proof ticket for one exact protected action.
    public func actionProof(
        authoritySessionToken: String,
        action: String,
        keyId: String,
        reason: String
    ) async throws -> String {
        let challengeResponse = try await postJSON(
            path: "/api/auth/biometric/challenge",
            authoritySessionToken: authoritySessionToken,
            body: ["action": action]
        )
        let challenge = try dictionary(challengeResponse["challenge"], "challenge")
        let challengeId = try string(challenge["id"], "challenge.id")
        let signingPayload = try string(
            challenge["signingPayload"],
            "challenge.signingPayload"
        )

        let signature = try await signer.sign(
            payload: signingPayload,
            keyId: keyId,
            reason: reason
        )

        let verification = try await postJSON(
            path: "/api/auth/biometric/verify",
            authoritySessionToken: authoritySessionToken,
            body: [
                "challengeId": challengeId,
                "keyId": keyId,
                "signature": signature,
            ]
        )
        let proof = try dictionary(verification["proof"], "proof")
        return try string(proof["proofId"], "proof.proofId")
    }

    /// Revokes a server-side public key only after another enrolled key signs a
    /// fresh revocation proof. Local Secure Enclave deletion is then explicit.
    public func revoke(
        authoritySessionToken: String,
        keyIdToRevoke: String,
        signingKeyId: String,
        deleteLocalKeyAfterServerRevocation: Bool = false
    ) async throws -> [String: Any] {
        let proofId = try await actionProof(
            authoritySessionToken: authoritySessionToken,
            action: "security.biometric.revoke",
            keyId: signingKeyId,
            reason: "Authorize Founder Face ID key revocation"
        )

        let response = try await postJSON(
            path: "/api/auth/biometric/keys/\(urlPathComponent(keyIdToRevoke))/revoke",
            authoritySessionToken: authoritySessionToken,
            extraHeaders: ["x-janus-biometric-proof": proofId],
            body: ["confirmAction": "revoke_founder_face_key"]
        )

        if deleteLocalKeyAfterServerRevocation {
            try signer.deleteLocalKey(keyId: keyIdToRevoke)
        }
        return response
    }

    private func postJSON(
        path: String,
        authoritySessionToken: String,
        extraHeaders: [String: String] = [:],
        body: [String: Any]
    ) async throws -> [String: Any] {
        let url = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
            "Bearer \(authoritySessionToken)",
            forHTTPHeaderField: "Authorization"
        )
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (name, value) in extraHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw JanusFounderBiometricClientError.invalidResponse
        }

        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard (200..<300).contains(http.statusCode) else {
            let message = json?["error"] as? String
                ?? String(data: data, encoding: .utf8)
                ?? "unknown error"
            throw JanusFounderBiometricClientError.http(http.statusCode, message)
        }
        guard let json else {
            throw JanusFounderBiometricClientError.invalidResponse
        }
        return json
    }

    private func dictionary(_ value: Any?, _ field: String) throws -> [String: Any] {
        guard let dictionary = value as? [String: Any] else {
            throw JanusFounderBiometricClientError.missingField(field)
        }
        return dictionary
    }

    private func string(_ value: Any?, _ field: String) throws -> String {
        guard let string = value as? String, !string.isEmpty else {
            throw JanusFounderBiometricClientError.missingField(field)
        }
        return string
    }

    private func urlPathComponent(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    private static func isAllowedBaseURL(_ url: URL) -> Bool {
        if url.scheme?.lowercased() == "https" {
            return true
        }
        guard url.scheme?.lowercased() == "http" else {
            return false
        }
        let host = url.host?.lowercased()
        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }
}
