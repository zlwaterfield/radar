import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { UpdateUserDto, UserResponseDto } from '../dto/users.dto';
import { AuthGuard } from '@/auth/guards/auth.guard';
import { GetUser } from '@/auth/decorators/user.decorator';
import type { User } from '@prisma/client';
import { nullToUndefined } from '@/common/utils/json-validation.util';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  async getCurrentUser(@GetUser() user: User): Promise<UserResponseDto> {
    const userProfile = await this.usersService.getUserById(user.id);

    if (!userProfile) {
      throw new NotFoundException('User not found');
    }

    return {
      id: userProfile.id,
      name: nullToUndefined(userProfile.name),
      email: nullToUndefined(userProfile.email),
      image: nullToUndefined(userProfile.image),
      isActive: userProfile.isActive,
      slackId: nullToUndefined(userProfile.slackId),
      slackTeamId: nullToUndefined(userProfile.slackTeamId),
      githubId: nullToUndefined(userProfile.githubId),
      githubLogin: nullToUndefined(userProfile.githubLogin),
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
    };
  }

  /**
   * Update current user profile
   */
  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    type: UserResponseDto,
  })
  async updateCurrentUser(
    @GetUser() user: User,
    @Body() updateData: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const updatedUser = await this.usersService.updateUser(user.id, updateData);

    return {
      id: updatedUser.id,
      name: nullToUndefined(updatedUser.name),
      email: nullToUndefined(updatedUser.email),
      image: nullToUndefined(updatedUser.image),
      isActive: updatedUser.isActive,
      slackId: nullToUndefined(updatedUser.slackId),
      slackTeamId: nullToUndefined(updatedUser.slackTeamId),
      githubId: nullToUndefined(updatedUser.githubId),
      githubLogin: nullToUndefined(updatedUser.githubLogin),
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * Delete current user account
   */
  @Delete('me')
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  async deleteCurrentUser(@GetUser() user: User) {
    const success = await this.usersService.deleteUser(user.id);

    if (!success) {
      throw new BadRequestException('Failed to delete account');
    }

    return {
      message: 'Account deleted successfully',
    };
  }

  /**
   * Get user by ID (admin only for now)
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  async getUserById(@Param('id') id: string): Promise<UserResponseDto> {
    const user = await this.usersService.getUserById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: nullToUndefined(user.name),
      email: nullToUndefined(user.email),
      image: nullToUndefined(user.image),
      isActive: user.isActive,
      slackId: nullToUndefined(user.slackId),
      slackTeamId: nullToUndefined(user.slackTeamId),
      githubId: nullToUndefined(user.githubId),
      githubLogin: nullToUndefined(user.githubLogin),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get users by team
   */
  @Get('team/:teamId')
  @ApiOperation({ summary: 'Get users by Slack team ID' })
  @ApiResponse({ status: 200, description: 'Team members' })
  async getUsersByTeam(@Param('teamId') teamId: string) {
    const users = await this.usersService.getUsersByTeam(teamId);

    return {
      teamId,
      members: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        slackId: user.slackId,
        githubId: user.githubId,
        githubLogin: user.githubLogin,
        createdAt: user.createdAt,
      })),
      count: users.length,
    };
  }
}
