import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EmailProvider } from './email.provider'

@Module({
  imports: [ConfigModule],
  providers: [EmailProvider],
  exports: [EmailProvider],
})
export class EmailModule {}
