import 'reflect-metadata';

// ------------------------------------------------------------------
// CLI commands for cronjobs, etc.
//
// You can execute CLI commands manually with:
// taito exec:server:ENV ./cli.sh COMMAND [ARGS...]
//
// You can also schedule CLI command execution with cronjobs. See
// `scripts/helm/examples.yaml` for examples.
// ------------------------------------------------------------------

export const commands = {};

const main = () => {
  const command = process.argv[2];
  // @ts-ignore
  const func = commands[command];
  if (!func) {
    console.error(`ERROR: Unknown command '${command}'.`);
    process.exit(1);
  }
  func(...process.argv.slice(3));
};

if (require.main === module) {
  main();
}
