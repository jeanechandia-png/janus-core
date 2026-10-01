import Foundation
import LocalAuthentication
import Security

public enum JanusFounderFaceSignerError: LocalizedError {
    case faceIDUnavailable(String)
    case secureEnclaveUnavailable(String)
    case keyUnavailable(String)
    case invalidPublicKey
    case signingFailed(String)
    case deletionFailed(OSStatus)

    public var errorDescription: String? {
        switch self {
        case .faceIDUnavailable(let message):
            return "Face ID is unavailable: \(message)"
        case .secureEnclaveUnavailable(let message):
            return "Secure Enclave key operation failed: \(message)"
        case .keyUnavailable(let keyId):
            return "Founder Face ID key is unavailable: \(keyId)"
        case .invalidPublicKey:
            return "Secure Enclave returned an unexpected P-256 public key representation."
        case .signingFailed(let message):
            return "Face-gated signing failed: \(message)"
        case .deletionFailed(let status):
            return "Local Founder key deletion failed with OSStatus \(status)."
        }
    }
}

public struct JanusFounderFaceKeyDescriptor: Sendable {
    public let keyId: String
    public let publicKeyPEM: String
    public let protection: String

    public init(keyId: String, publicKeyPEM: String) {
        self.keyId = keyId
        self.publicKeyPEM = publicKeyPEM
        self.protection = "SecureEnclave+FaceID+biometryCurrentSet"
    }
}

/// Native iPhone signer for JANUS CORE Founder biometric challenges.
///
/// Security boundary:
/// - the P-256 private key is generated inside Secure Enclave;
/// - the key is permanent but non-exportable;
/// - private-key usage requires the currently enrolled Face ID set;
/// - changing Face ID enrollment invalidates the key;
/// - Janus receives only the SPKI public key and ECDSA signatures.
public final class JanusFounderFaceSigner {
    private let applicationTagPrefix: String

    public init(applicationTagPrefix: String = "com.infinity.janus.founder.face") {
        self.applicationTagPrefix = applicationTagPrefix
    }

    public func createKeyIfNeeded(keyId: String) throws -> JanusFounderFaceKeyDescriptor {
        try validateKeyId(keyId)

        if let existing = try loadPrivateKey(keyId: keyId, context: nil, allowMissing: true) {
            return try descriptor(for: existing, keyId: keyId)
        }

        let context = try faceIDContext(reason: "Enroll Founder Face ID for Janus")
        var accessError: Unmanaged<CFError>?
        guard let accessControl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryCurrentSet],
            &accessError
        ) else {
            throw JanusFounderFaceSignerError.secureEnclaveUnavailable(
                cfErrorMessage(accessError)
            )
        }

        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: applicationTagData(keyId),
                kSecAttrAccessControl as String: accessControl,
            ],
        ]

        var creationError: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(
            attributes as CFDictionary,
            &creationError
        ) else {
            throw JanusFounderFaceSignerError.secureEnclaveUnavailable(
                cfErrorMessage(creationError)
            )
        }

        return try descriptor(for: privateKey, keyId: keyId)
    }

    public func keyDescriptor(keyId: String) throws -> JanusFounderFaceKeyDescriptor {
        try validateKeyId(keyId)
        guard let privateKey = try loadPrivateKey(
            keyId: keyId,
            context: nil,
            allowMissing: false
        ) else {
            throw JanusFounderFaceSignerError.keyUnavailable(keyId)
        }
        return try descriptor(for: privateKey, keyId: keyId)
    }

    public func sign(
        payload: String,
        keyId: String,
        reason: String
    ) async throws -> String {
        try validateKeyId(keyId)
        let context = try faceIDContext(reason: reason)

        guard let privateKey = try loadPrivateKey(
            keyId: keyId,
            context: context,
            allowMissing: false
        ) else {
            throw JanusFounderFaceSignerError.keyUnavailable(keyId)
        }

        let algorithm = SecKeyAlgorithm.ecdsaSignatureMessageX962SHA256
        guard SecKeyIsAlgorithmSupported(privateKey, .sign, algorithm) else {
            throw JanusFounderFaceSignerError.signingFailed(
                "P-256 ECDSA/SHA-256 is not supported by this key."
            )
        }

        let data = Data(payload.utf8)
        var signingError: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            algorithm,
            data as CFData,
            &signingError
        ) as Data? else {
            throw JanusFounderFaceSignerError.signingFailed(
                cfErrorMessage(signingError)
            )
        }

        return base64URL(signature)
    }

    /// Local deletion is intentionally explicit. Call only after JANUS CORE has
    /// recorded server-side revocation and another active Founder key exists.
    public func deleteLocalKey(keyId: String) throws {
        try validateKeyId(keyId)
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: applicationTagData(keyId),
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw JanusFounderFaceSignerError.deletionFailed(status)
        }
    }

    private func descriptor(
        for privateKey: SecKey,
        keyId: String
    ) throws -> JanusFounderFaceKeyDescriptor {
        guard let attributes = SecKeyCopyAttributes(privateKey) as? [String: Any],
              (attributes[kSecAttrTokenID as String] as? String)
                == (kSecAttrTokenIDSecureEnclave as String),
              (attributes[kSecAttrKeySizeInBits as String] as? Int) == 256 else {
            throw JanusFounderFaceSignerError.secureEnclaveUnavailable(
                "Loaded key is not a 256-bit Secure Enclave key."
            )
        }

        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw JanusFounderFaceSignerError.invalidPublicKey
        }

        var exportError: Unmanaged<CFError>?
        guard let x963 = SecKeyCopyExternalRepresentation(
            publicKey,
            &exportError
        ) as Data? else {
            throw JanusFounderFaceSignerError.secureEnclaveUnavailable(
                cfErrorMessage(exportError)
            )
        }

        return JanusFounderFaceKeyDescriptor(
            keyId: keyId,
            publicKeyPEM: try p256SPKIPEM(x963: x963)
        )
    }

    private func loadPrivateKey(
        keyId: String,
        context: LAContext?,
        allowMissing: Bool
    ) throws -> SecKey? {
        var query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: applicationTagData(keyId),
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        if let context {
            query[kSecUseAuthenticationContext as String] = context
        }

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound && allowMissing {
            return nil
        }
        guard status == errSecSuccess, let key = item else {
            if status == errSecItemNotFound {
                throw JanusFounderFaceSignerError.keyUnavailable(keyId)
            }
            throw JanusFounderFaceSignerError.secureEnclaveUnavailable(
                "SecItemCopyMatching OSStatus \(status)"
            )
        }
        return (key as! SecKey)
    }

    private func faceIDContext(reason: String) throws -> LAContext {
        let context = LAContext()
        context.localizedReason = reason
        context.localizedFallbackTitle = ""
        var error: NSError?
        guard context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        ) else {
            throw JanusFounderFaceSignerError.faceIDUnavailable(
                error?.localizedDescription ?? "biometric policy cannot be evaluated"
            )
        }
        guard context.biometryType == .faceID else {
            throw JanusFounderFaceSignerError.faceIDUnavailable(
                "Founder policy requires Face ID; passcode/Touch ID fallback is not accepted."
            )
        }
        return context
    }

    private func applicationTagData(_ keyId: String) -> Data {
        Data("\(applicationTagPrefix).\(keyId)".utf8)
    }

    private func validateKeyId(_ keyId: String) throws {
        let pattern = #"^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$"#
        guard keyId.range(of: pattern, options: .regularExpression) != nil else {
            throw JanusFounderFaceSignerError.keyUnavailable("invalid keyId")
        }
    }

    private func p256SPKIPEM(x963: Data) throws -> String {
        guard x963.count == 65, x963.first == 0x04 else {
            throw JanusFounderFaceSignerError.invalidPublicKey
        }

        // SubjectPublicKeyInfo for id-ecPublicKey + prime256v1, followed by the
        // uncompressed 65-byte X9.63 point returned by Security.framework.
        let spkiPrefix = Data([
            0x30, 0x59,
            0x30, 0x13,
            0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01,
            0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07,
            0x03, 0x42, 0x00,
        ])
        let der = spkiPrefix + x963
        let body = der.base64EncodedString(options: [.lineLength64Characters])
        return "-----BEGIN PUBLIC KEY-----\n\(body)\n-----END PUBLIC KEY-----\n"
    }

    private func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func cfErrorMessage(_ unmanaged: Unmanaged<CFError>?) -> String {
        guard let unmanaged else { return "unknown Security.framework error" }
        return (unmanaged.takeRetainedValue() as Error).localizedDescription
    }
}
