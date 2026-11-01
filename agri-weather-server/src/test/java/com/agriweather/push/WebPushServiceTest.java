package com.agriweather.push;

import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.interfaces.ECPrivateKey;
import org.bouncycastle.jce.interfaces.ECPublicKey;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class WebPushServiceTest {

    @Test
    void initializesWithGeneratedVapidKeys() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        KeyPairGenerator generator = KeyPairGenerator.getInstance("ECDH", "BC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair keyPair = generator.generateKeyPair();

        String publicKey = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Utils.encode((ECPublicKey) keyPair.getPublic()));
        String privateKey = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Utils.encode((ECPrivateKey) keyPair.getPrivate()));

        PushService service = new PushService(publicKey, privateKey, "mailto:test@example.com");
        assertNotNull(service);
        assertNotNull(service.getKeyPair());
    }
}