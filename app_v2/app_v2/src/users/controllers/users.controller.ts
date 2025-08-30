import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from '../dto/users.dto';
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
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
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
      slackId: userProfile.slackId,
      slackTeamId: userProfile.slackTeamId,
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
  @ApiResponse({ status: 200, description: 'Profile updated', type: UserResponseDto })
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
      slackId: updatedUser.slackId,
      slackTeamId: updatedUser.slackTeamId,
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
  @ApiResponse({ status: 200, description: 'User profile', type: UserResponseDto })
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
      slackId: user.slackId,
      slackTeamId: user.slackTeamId,
      githubId: nullToUndefined(user.githubId),
      githubLogin: nullToUndefined(user.githubLogin),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get all users with pagination
   */
  @Get()
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated users list' })
  async getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const pageNum = Math.max(1, parseInt(page.toString()));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit.toString())));

    const result = await this.usersService.getUsers(pageNum, limitNum);

    return {
      ...result,
      users: result.users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        isActive: user.isActive,
        slackId: user.slackId,
        slackTeamId: user.slackTeamId,
        githubId: user.githubId,
        githubLogin: user.githubLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    };
  }

  /**
   * Search users
   */
  @Get('search')
  @ApiOperation({ summary: 'Search users by name or email' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchUsers(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters long');
    }

    const users = await this.usersService.searchUsers(query.trim());

    return {
      results: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        slackId: user.slackId,
        githubId: user.githubId,
        githubLogin: user.githubLogin,
      })),
      count: users.length,
    };
  }

  /**
   * Get user statistics
   */
  @Get('stats/overview')
  @ApiOperation({ summary: 'Get user statistics overview' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  async getUserStats() {
    return this.usersService.getUserStats();
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
      members: users.map(user => ({
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