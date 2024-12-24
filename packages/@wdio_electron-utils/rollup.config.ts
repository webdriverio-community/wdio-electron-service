import { RollupOptionCreator } from '@wdio/electron-bundler';

const creator = new RollupOptionCreator();

export default creator.getConfigs();
