import React, { useEffect, useReducer, useState } from 'react';
import Paper from '@material-ui/core/Paper';
import axios from "axios";
import eth from './eth';
import client from "./client";
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@material-ui/core';
import WCClient from "@walletconnect/client";
import * as ethers from "ethers";
import { find } from 'lodash';

const clientMeta = {
  description: "Ledger Web",
  url: "https://ledger-web.vercel.app/",
  icons: ["https://cdn.live.ledger.com/live/icon-512.png"],
  name: "Ledger Web",
};

const styles = (theme: Theme) =>
  createStyles({
    paper: {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      padding: theme.spacing(3, 3)
    },
    formControl: {
      marginTop: theme.spacing(2)
    },
  });

export interface WalletConnectProps extends WithStyles<typeof styles> {}

let connector: WCClient | null;

function WalletConnect(props: WalletConnectProps) {
  const { classes } = props;
  const [form, dispatch] = useReducer((state: any, u: any) => ({...state, ...u}), {
    derivation: 0,
    address: 0,
    chainId: 1,
  });
  const [wc, dispatchWC] = useReducer((state: any, u: any) => ({...state, ...u}), {
    connected: false,
  });
  const [scanning, setScanning] = useState(false);
  const [addresses, setAddresses] = useState<{
    publicKey: string;
    address: string;
    chainCode?: string | undefined;
    path: string,
  }[]>([]);

  const onChange = (event: { target: { id: string; value: string; }; }) =>
    dispatch({
      [event.target.id]: event.target.value,
    });

  const scan = async () => {
    if (form.derivation > 0) {
      return alert("no supported yet");
    }

    try {
      await client.request("devices", "requireApp", [{
        name: "Ethereum"
      }]);
    } catch(e) {
      return alert("app not accessible");
    }

    setScanning(true);

    let addresses = [];
    try {
      let i = 0;
      while (addresses.length < 10) {
        addresses.push({
          ...(await eth.getAddress(`44'/60'/${i}'/0/0`)),
          path: `44'/60'/${i}'/0/0`
        });
        i += 1;
      }
    } catch (e) {
      console.log(e);
      setScanning(false);
      return alert("getAddress error, is your device sleepy ?");
    }

    setScanning(false);
    setAddresses(addresses);
  }

  const connect = async () => {
    connector = new WCClient({ uri: form.bridge, clientMeta });

    const disconnect = () => {
      dispatch({ bridge: null });
      dispatchWC({
        connected: false,
        connecting: false,
        disconnect: null,
        updateSession: null,
      });
      if (connector) {
        connector.killSession();
      }
      connector = null;
    }

    connector.on("session_request", (error, payload) => {
      connector?.approveSession({
        accounts: [addresses[form.address].address],
        chainId: form.chainId,
      });
    });

    connector.on("connect", () => {
      dispatchWC({
        connected: true,
        connecting: false,
        updateSession: (args: {
          chainId: number,
          accounts: string[]
        }) => {
          connector?.updateSession(args)
        }
      });
    });

    connector.on("disconnect", () => {
      disconnect();
    });

    connector.on("error", (error) => {
      console.log("wc error", error);
      disconnect();
    });

    connector.on("call_request", async (error, payload) => {
      console.log(payload);

      const reject = (message: string) => {
        connector?.rejectRequest({
          id: payload.id,
          error: { message },
        });
      }

      switch(payload.method) {
        // @ts-ignore
        case "eth_sendTransaction":
          const unsignedTx: ethers.utils.UnsignedTransaction = {
            to: payload.params[0].to,
            data: payload.params[0].data,
            chainId: connector?.session.chainId,
          };

          if(payload.params[0].nonce) {
            unsignedTx.nonce = parseInt(payload.params[0].nonce, 16);
          }
          if(payload.params[0].gas) {
            unsignedTx.gasLimit = ethers.BigNumber.from(payload.params[0].gas);
          }
          if(payload.params[0].gasPrice) {
            unsignedTx.gasPrice = ethers.BigNumber.from(payload.params[0].gasPrice);
          }
          if(payload.params[0].value) {
            unsignedTx.value = ethers.BigNumber.from(payload.params[0].value);
          }

          const address = connector?.session.accounts[0];
          // @ts-ignore
          const path: string = find(addresses, { address })?.path;

          if (!unsignedTx.nonce) {
            const res = await axios.get(
              `https://api.etherscan.io/api?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=GPGACJA64X1GQUSG4KIUTXUFUMQXISPISZ`
            );
            unsignedTx.nonce = parseInt(res.data.result, 16);
          }
          if (!unsignedTx.gasPrice) {
            const res = await axios.get(
              `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=GPGACJA64X1GQUSG4KIUTXUFUMQXISPISZ`
            );
            const gwei = ethers.BigNumber.from(10).pow(9);
            unsignedTx.gasPrice = ethers.BigNumber.from(res.data.result.FastGasPrice).mul(gwei);
          }

          const unsignedTxHex = ethers.utils.serializeTransaction(unsignedTx);

          try {
            await client.request("devices", "requireApp", [{
              name: "Ethereum"
            }]);
          } catch(e) {
            return reject("app not accessible");
          }
      
          await client.request("devices", "requireDeviceActionStart", [{}]);
          
          let result;
          try {
            result = await eth.signTransaction(path, unsignedTxHex.slice(2));
          } catch(e) {
            await client.request("devices", "requireDeviceActionEnd", [{}]);
            console.log(e);
            // TODO : when ledger-web-hw-transport relay correctly the error, display correct
            // message
            return reject("build tx error : did you reject or is your device sleeping ?");
          }
      
          await client.request("devices", "requireDeviceActionEnd", [{}]);

          let v = result.v;
          // @ts-ignore
          if (unsignedTx.chainId > 0) {
            // EIP155 support. check/recalc signature v value.
            let rv = parseInt(v, 16);
            // @ts-ignore
            let cv = unsignedTx.chainId * 2 + 35;
            if (rv !== cv && (rv & cv) !== rv) {
              cv += 1; // add signature v bit.
            }
            v = cv.toString(16);
          }

          let signature = {
            r: `0x${result.r}`,
            s: `0x${result.s}`,
            v: parseInt(v, 16)
          }

          const signedTxHex = ethers.utils.serializeTransaction(
            unsignedTx,
            signature
          );

          let res;
          try {
            res = await axios.get(
              `https://api.etherscan.io/api?module=proxy&action=eth_sendRawTransaction&hex=${signedTxHex}&apikey=GPGACJA64X1GQUSG4KIUTXUFUMQXISPISZ`
            );
          } catch(e) {
            return reject("broadcast error " + e.message)
          }

          if (res.data.error) {
            return reject("broadcast error " + res.data.error.message)
          }

          connector?.approveRequest({
            id: payload.id,
            result: res.data.result
          });
          break;
        // eslint-disable-next-line no-fallthrough
        case "eth_signTypedData":
        case "eth_sign":
        case "personal_sign":
        case "eth_signTransaction":
        default:
          reject("not implemented yet");
      }
    });

    dispatchWC({
      connecting: true,
      disconnect,
    });
  };

  useEffect(() => {
    if (!wc.connected) {
      return;
    }

    wc.updateSession({
      chainId: form.chainId,
      accounts: [addresses[form.address].address],
    })
  }, [wc.connected, form.chainId, form.address, wc, addresses])

  useEffect(() => {
    // disconect on unmount
    return () => {
      if (connector) {
        connector.killSession();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Paper className={classes.paper}>
      {!addresses.length ? (
        <>
          <Typography variant="h6">
            1. Select accounts
          </Typography>
          <FormControl className={classes.formControl}>
            <InputLabel id="derivation-label">Choose derivation</InputLabel>
            <Select
              labelId="derivation-label"
              id="derivation"
              disable={scanning}
              value={form.derivation}
              // @ts-ignore
              onChange={(event: { target: { value: string; }; }) => onChange({
                target: {
                  id: "derivation",
                  value: event.target.value
                }
              })}
            >
              <MenuItem value={0}>Ethereum - Ledger Live - m/44'/60'</MenuItem>
              <MenuItem value={1}>Ethereum - m/44'/60'/0'</MenuItem>
            </Select>
          </FormControl>
          <Box m={2} />
          <Button
            variant="contained"
            color="primary"
            onClick={scan}
            disabled={scanning}
          >
            Scan{scanning ? 'ning...' : ''}
          </Button>
        </>
      ) : (
        <>
          <Typography variant="h6">
            2. Wallet Connect
          </Typography>
          {<FormControl className={classes.formControl}>
            <InputLabel id="address-label">Choose address</InputLabel>
            <Select
              labelId="address-label"
              id="address"
              value={form.address}
              // @ts-ignore
              onChange={(event: { target: { value: string; }; }) => onChange({
                target: {
                  id: "address",
                  value: event.target.value
                }
              })}
            >
              {addresses.map(({ address }, i) => (
                <MenuItem key={address} value={i}>{address}</MenuItem>
              ))}
            </Select>
          </FormControl>}
          <FormControl className={classes.formControl}>
            <InputLabel id="chainId-label">Choose chainId</InputLabel>
            <Select
              labelId="chainId-label"
              id="chainId"
              value={form.chainId}
              // @ts-ignore
              onChange={(event: { target: { value: string; }; }) => onChange({
                target: {
                  id: "chainId",
                  value: event.target.value
                }
              })}
            >
              <MenuItem value={1}>Ethereum Mainnet</MenuItem>
            </Select>
          </FormControl>
          <TextField
            id="bridge"
            label="Bridge url"
            required
            disabled={wc.connected || wc.connecting}
            value={form.bridge || ""}
            onChange={onChange}
          />
          <Box m={2} />
          {!wc.connected && !wc.connecting ? (
            <Button
              variant="contained"
              color="primary"
              onClick={connect}
            >
              Connect
            </Button>
          ) : wc.connected && !wc.connecting ? (
            <Button
              variant="contained"
              color="primary"
              onClick={wc.disconnect}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              disabled={true}
              onClick={connect}
            >
              Connecting...
            </Button>
          )}
        </>
      )}
    </Paper>
  );
}

export default withStyles(styles)(WalletConnect);
