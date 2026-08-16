import { Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditLogDocument, AuditLogSchema } from './schemas/audit-log.schema'
import { AuditService } from './audit.service'
import { AuditController } from './audit.controller'

// Global so any module can inject AuditService without re-importing.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLogDocument.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
