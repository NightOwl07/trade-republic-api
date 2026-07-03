import qrcode from "qrcode-terminal";
import { TradeRepublicApi, createMessage } from "../src/index";

const api = new TradeRepublicApi();

const ok = await api.loginWithQrCode((qrCodePayload) => {
    console.clear();
    console.log("Scan this QR code with your Trade Republic app to log in:\n");


    qrcode.generate(qrCodePayload, { small: true });

    console.log(`\nPayload: ${qrCodePayload}`);
    console.log("Waiting for confirmation in the app...");
});

if (!ok) {
    console.error("QR-code login failed.");
    process.exit(1);
}

console.log("\nLogged in! Fetching available cash...");
api.subscribeOnce(createMessage("availableCash"), (cash) => {
    console.log(cash);
    process.exit(0);
});
