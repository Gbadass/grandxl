import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import { isValidObjectId } from '@grandxl/utils'
import { ERROR_MESSAGES } from '../constants/error-messages'

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_ID)
    }
    return value
  }
}
