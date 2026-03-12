/* eslint-disable no-console */

import { dataSource } from 'config/data-source';

const dataDown = async () => {
  const db = await dataSource.initialize();

  // eslint-disable-next-line @typescript-eslint/require-await
  await db.manager.transaction(async (_manager) => {
    console.log(`Start deleting all data`);
  });
};

dataDown()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
