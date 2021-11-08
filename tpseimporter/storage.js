export const tpse = {};
export const storage = {};
storage.get = () => storage;
storage.set = vals => Object.assign(tpse, vals);
storage.remove = arg => {
  let keys = Array.isArray(arg) ? arg : [arg];
  for (let key of keys)
    delete tpse[key];
};
storage.clear = () => (storage = {});
