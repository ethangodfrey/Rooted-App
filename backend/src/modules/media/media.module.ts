import { Module } from '@nestjs/common';

import { VendorMediaController } from './vendor-media.controller';
import { VendorMediaService } from './vendor-media.service';

@Module({
  controllers: [VendorMediaController],
  providers: [VendorMediaService],
})
export class MediaModule {}
