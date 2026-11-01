package com.agriweather.push;

import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

/**
 * 生成一对 VAPID 密钥，用于 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY。
 *
 * 运行：
 * ./mvnw -q org.codehaus.mojo:exec-maven-plugin:3.1.0:java \
 *   -Dexec.mainClass=com.agriweather.push.VapidKeyGenerator
 *
 * 生成一次后固定使用；多实例必须共享同一对密钥，否则已有订阅会失效。
 */
public final class VapidKeyGenerator {

    private VapidKeyGenerator() {
    }

    public static void main(String[] args) throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        KeyPairGenerator generator = KeyPairGenerator.getInstance("ECDH", "BC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair keyPair = generator.generateKeyPair();

        String publicKey = encode(Utils.encode((ECPublicKey) keyPair.getPublic()));
        String privateKey = encode(Utils.encode((ECPrivateKey) keyPair.getPrivate()));

        System.out.println("VAPID_PUBLIC_KEY=" + publicKey);
        System.out.println("VAPID_PRIVATE_KEY=" + privateKey);
        System.out.println("VAPID_SUBJECT=mailto:you@example.com");
    }

    private static String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}