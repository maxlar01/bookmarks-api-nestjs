import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: AuthDto) {
    // Generate password hash
    const hash = await argon.hash(dto.password);
    try {
      // Save the new user in the db
      const user = await this.prismaService.user.create({
        data: {
          email: dto.email,
          password: hash,
        },
      });

      delete user.password;

      // Send back JWT
      return this.signToken(user.id, user.email);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials are taken!');
        }
      } else throw error;
    }
  }

  async signin(dto: AuthDto) {
    // Find user by email
    const user = await this.prismaService.user.findFirst({
      where: {
        email: dto.email,
      },
    });

    // If user does not exist throw exception
    if (!user) throw new ForbiddenException('Credentials incorrect!');

    // Compare password
    const pwMatches = await argon.verify(user.password, dto.password);

    // If password is incorrect then throw exception
    if (!pwMatches) throw new ForbiddenException('Credentials incorrect!');

    // Send back JWT
    return this.signToken(user.id, user.email);
  }

  async signToken(
    userId: number,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
    };

    const access_token = await this.jwt.signAsync(payload, {
      expiresIn: '15m',
      secret: this.config.get('JWT_SECRET'),
    });

    return { access_token };
  }
}
