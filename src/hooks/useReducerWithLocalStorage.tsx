import { useEffect, useReducer, useState } from 'react';

const load = async (key: string, onLoaded: Function, setLoaded: Function, onload?: (state: any) => Promise<any>) => {
  if (!onload) {
    return;
  }
  try {
    const item = window.localStorage.getItem(key);
    if (!item) {
      console.log("loaded");
      return setLoaded(true);
    }
    const stored = JSON.parse(item);
    const value = await onload(stored);
    onLoaded(value);
    setLoaded(true);
    console.log("loaded");
  } catch(e) {
    setLoaded(true);
    console.log("load error", e);
  }
}

const store = async(key: string, data: any, onsave?: (data: any) => Promise<any>) => {
  if (!onsave) {
    return
  }
  console.log("save", data);
  try {
    const final = await onsave(data);
    window.localStorage.setItem(key, JSON.stringify(final));
  } catch(e) {
    console.log("save error", e);
  }
}

function useReducerWithLocalStorage(
  key: string,
  reducer: (state: any, update: any) => any,
  initialValue: any,
  prepare?: { onsave: (state: any) => Promise<any>, onload: (data: any) => Promise<any> }
) {
  const [loaded, setLoaded] = useState(false);

  const [state, dispatch] = useReducer(
    reducer,
    initialValue
  );

  useEffect(() => {
    load(key, (state: any) => dispatch({ type: "init", state }), setLoaded, prepare?.onload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, setLoaded]);

  useEffect(() => {
    if (loaded) {
      store(key, state, prepare?.onsave);
    }
  }, [key, loaded, prepare?.onsave, state])

  return [state, dispatch];
}

export default useReducerWithLocalStorage;