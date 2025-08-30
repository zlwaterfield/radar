import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@/database/database.service';
import { CreateUserDto, UpdateUserDto } from '../dto/users.dto';
import type { User, UserSettings } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      return await this.databaseService.user.findUnique({
        where: { id },
        include: {
          settings: true,
          repositories: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting user by ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Get user by Slack ID
   */
  async getUserBySlackId(slackId: string): Promise<User | null> {
    try {
      return await this.databaseService.user.findUnique({
        where: { slackId },
        include: {
          settings: true,
          repositories: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting user by Slack ID ${slackId}:`, error);
      return null;
    }
  }

  /**
   * Get user by GitHub ID
   */
  async getUserByGitHubId(githubId: string): Promise<User | null> {
    try {
      return await this.databaseService.user.findUnique({
        where: { githubId },
        include: {
          settings: true,
          repositories: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting user by GitHub ID ${githubId}:`, error);
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      return await this.databaseService.user.findUnique({
        where: { email },
        include: {
          settings: true,
          repositories: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error getting user by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Create new user
   */
  async createUser(data: CreateUserDto): Promise<User> {
    try {
      const user = await this.databaseService.user.create({
        data: {
          name: data.name,
          email: data.email,
          image: data.image,
          slackId: data.slackId,
          slackTeamId: data.slackTeamId,
          slackAccessToken: data.slackAccessToken,
          slackRefreshToken: data.slackRefreshToken,
          githubId: data.githubId,
          githubLogin: data.githubLogin,
          githubAccessToken: data.githubAccessToken,
          githubRefreshToken: data.githubRefreshToken,
        },
        include: {
          settings: true,
          repositories: true,
        },
      });

      this.logger.log(`Created user ${user.id} with name ${user.name}`);
      return user;
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    try {
      const user = await this.databaseService.user.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          settings: true,
          repositories: true,
        },
      });

      this.logger.log(`Updated user ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete user and all related data
   */
  async deleteUser(id: string): Promise<boolean> {
    try {
      // Delete user (cascading will handle related records)
      await this.databaseService.user.delete({
        where: { id },
      });

      this.logger.log(`Deleted user ${id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting user ${id}:`, error);
      return false;
    }
  }

  /**
   * Activate user account
   */
  async activateUser(id: string): Promise<User> {
    return this.updateUser(id, { isActive: true });
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(id: string): Promise<User> {
    return this.updateUser(id, { isActive: false });
  }

  /**
   * Get all users with pagination
   */
  async getUsers(page = 1, limit = 20): Promise<{
    users: User[];
    total: number;
    pages: number;
    currentPage: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      const [users, total] = await Promise.all([
        this.databaseService.user.findMany({
          skip,
          take: limit,
          include: {
            settings: true,
            repositories: {
              take: 5,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.databaseService.user.count(),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        users,
        total,
        pages,
        currentPage: page,
      };
    } catch (error) {
      this.logger.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Search users by name or email
   */
  async searchUsers(query: string, limit = 10): Promise<User[]> {
    try {
      return await this.databaseService.user.findMany({
        where: {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: query,
                mode: 'insensitive',
              },
            },
          ],
        },
        take: limit,
        include: {
          settings: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.logger.error(`Error searching users with query "${query}":`, error);
      return [];
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    withSlack: number;
    withGitHub: number;
    recentSignups: number;
  }> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [total, active, recentSignups] = await Promise.all([
        this.databaseService.user.count(),
        this.databaseService.user.count({
          where: { isActive: true },
        }),
        this.databaseService.user.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
      ]);

      // TODO: Fix null filtering for these stats later
      const withSlack = 0; // Placeholder - will implement proper counting later
      const withGitHub = 0; // Placeholder - will implement proper counting later

      return {
        total,
        active,
        withSlack,
        withGitHub,
        recentSignups,
      };
    } catch (error) {
      this.logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<User> {
    try {
      const user = await this.databaseService.user.update({
        where: { id },
        data: {
          emailVerified: true,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Email verified for user ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error verifying email for user ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get users by team (Slack team)
   */
  async getUsersByTeam(teamId: string): Promise<User[]> {
    try {
      return await this.databaseService.user.findMany({
        where: {
          slackTeamId: teamId,
          isActive: true,
        },
        include: {
          settings: true,
          repositories: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      this.logger.error(`Error getting users by team ${teamId}:`, error);
      return [];
    }
  }
}