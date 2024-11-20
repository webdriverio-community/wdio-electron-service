interface Config {
  productName: string;
}
module.exports = async (): Promise<Config> => {
  return {
    productName: 'builder-dependency-ts-fn-config',
  };
};
