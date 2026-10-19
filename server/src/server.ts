import { createApp } from './app';
import { config } from './config';

createApp().listen(config.PORT, () => {
  console.log(`MediSchedule API listening on http://localhost:${config.PORT}`);
});
