let testConfig: any = null;

const getTestConfig = async () => {
  if (testConfig) {
    return testConfig;
  }

  const c = {};

  if (!testConfig) {
    testConfig = c;
  }

  return testConfig;
};

export default getTestConfig;
