import { WindowPostMessageStream } from '@metamask/post-message-stream';
import LWClient from "ledger-web-client";

let name = "https://ledger-web-wallet-connect.vercel.app/";

if (process.env.NODE_ENV === "development") {
  name = "http://localhost:3003/"
}

export default new LWClient(new WindowPostMessageStream({
  name,
  target: 'ledger-web-parent',
  // todo when updating: https://github.com/MetaMask/post-message-stream/pull/23
    // targetOrigin: "*",
  targetWindow: window.parent || window,
}));
