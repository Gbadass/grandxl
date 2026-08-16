import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v2 as cloudinary } from 'cloudinary'

// Magic bytes for the formats we accept. Verified against the buffer's leading
// bytes to catch mimetype spoofing (browser-supplied Content-Type can be lied about).
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // 'RIFF' — full check also confirms WEBP at bytes 8-11
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: config.getOrThrow('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow('CLOUDINARY_API_SECRET'),
    })
  }

  async uploadImage(
    buffer: Buffer,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `grandxl/${folder}`,
          public_id: publicId,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Upload failed'))
          resolve({ url: result.secure_url, publicId: result.public_id })
        },
      )
      stream.end(buffer)
    })
  }

  async uploadDocument(
    buffer: Buffer,
    folder: string,
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `grandxl/${folder}`,
          public_id: publicId,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            console.error('[Cloudinary uploadDocument error]', JSON.stringify(error))
            return reject(new Error(error?.message ?? 'Cloudinary upload failed'))
          }
          resolve({ url: result.secure_url, publicId: result.public_id })
        },
      )
      stream.end(buffer)
    })
  }

  getSignedUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      type: 'private',
      secure: true,
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 15 * 60, // 15 min TTL
    })
  }

  validateMimeType(mimetype: string, allowed: string[]): void {
    if (!allowed.includes(mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Accepted: ${allowed.join(', ')}`,
      )
    }
  }

  // Verify the file buffer actually starts with the magic bytes for the claimed
  // mimetype. A crafted request could send `Content-Type: image/jpeg` while
  // uploading an exe — this catches that.
  validateMagicBytes(buffer: Buffer, mimetype: string): void {
    const signatures = MAGIC_BYTES[mimetype]
    if (!signatures) {
      // We only sniff formats we've enumerated; for others, `validateMimeType`
      // is the only gate. Log so we notice new formats slipping through.
      this.logger.warn(`No magic-byte signature registered for mimetype ${mimetype}`)
      return
    }
    const matches = signatures.some((sig) =>
      sig.every((byte, idx) => buffer[idx] === byte),
    )
    if (!matches) {
      throw new BadRequestException(
        `File content does not match declared type (${mimetype}). Possible tampering.`,
      )
    }
    // WEBP needs a second-stage check: bytes 8-11 must spell "WEBP".
    if (mimetype === 'image/webp') {
      const webpMarker = buffer.slice(8, 12).toString('ascii')
      if (webpMarker !== 'WEBP') {
        throw new BadRequestException('File claims image/webp but content is not a WEBP')
      }
    }
  }

  // Stub for future antivirus/malware scanning. When wired to ClamAV or similar,
  // this becomes an async call to the scanner and throws on infected. Callers
  // should already invoke it — flipping the switch later just changes the impl.
  async scanForMalware(_buffer: Buffer, _filename: string): Promise<void> {
    // TODO: integrate ClamAV daemon or S3-backed malware scanning.
    // For now this is intentionally a no-op — magic-byte validation catches the
    // most common vector (mimetype spoofing) but not real malware payloads.
    return
  }

  // One-shot gate for all upload endpoints: mimetype whitelist → magic-byte sniff
  // → malware scan stub. Every controller path should call this before touching Cloudinary.
  async validateAndScan(
    file: Express.Multer.File,
    allowedMimeTypes: string[],
  ): Promise<void> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Empty file')
    }
    this.validateMimeType(file.mimetype, allowedMimeTypes)
    this.validateMagicBytes(file.buffer, file.mimetype)
    await this.scanForMalware(file.buffer, file.originalname)
  }
}
