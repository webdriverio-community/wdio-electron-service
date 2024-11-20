interface Config {
  productName: string;
}
export default async (): Promise<Config> => {
  return {
    productName: 'builder-dependency-ts-fn-config',
  };
};
