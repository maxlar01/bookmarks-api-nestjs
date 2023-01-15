import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

@Injectable()
export class AuthService {
  constructor(private prismaService: PrismaService) {}

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

      // Return the newly created user
      return user;
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

    // Send back the user
    delete user.password;
    return user;
  }
}
