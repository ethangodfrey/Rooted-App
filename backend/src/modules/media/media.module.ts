import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { CreatorUploadController } from './creator-upload.controller';
import { CreatorUploadService } from './creator-upload.service';
import { MediaStreamingService } from './media-streaming.service';
import { VendorMediaController } from './vendor-media.controller';
import { VendorMediaService } from './vendor-media.service';

@Module({
  imports: [PrismaModule],
  controllers: [VendorMediaController, CreatorUploadController],
  providers: [VendorMediaService, MediaStreamingService, CreatorUploadService],
  exports: [VendorMediaService, MediaStreamingService, CreatorUploadService],
})
export class MediaModule {}
