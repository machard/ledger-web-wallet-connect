import LWHwTransport from "ledger-web-hw-transport";
import Eth from "@ledgerhq/hw-app-eth";
import client from "./client";

export default new Eth(new LWHwTransport(client));
