import { AuthRepository } from '../database/authRepository.js';
import { AppError } from '../helpers/errors.js';
import { AuthResult, UserProfile } from '../types/auth.js';
import { normalizePhone, OtpService } from './otpService.js';
import { TokenService } from './tokenService.js';

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  async requestOtp(phone: string): Promise<void> {
    await this.otpService.issue(phone);
  }

  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    const normalizedPhone = await this.otpService.verify(phone, code);
    let profile = await this.repository.findUserByPhone(normalizedPhone);
    if (!profile) profile = await this.repository.createUser(normalizedPhone);
    return this.toAuthResult(profile);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.repository.findUserById(userId);
    if (!profile) throw new AppError('not_found', 'User profile was not found', 404);
    return profile;
  }

  async updateProfile(userId: string, input: Partial<UserProfile>): Promise<UserProfile> {
    const changes: Partial<UserProfile> = {};
    if (input.full_name !== undefined) {
      if (input.full_name.trim().length < 2) throw new AppError('invalid_profile', 'Full name must be at least 2 characters', 422);
      changes.full_name = input.full_name.trim();
    }
    if (input.email !== undefined) {
      if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) throw new AppError('invalid_profile', 'Please enter a valid email address', 422);
      changes.email = input.email || null;
    }
    if (input.city !== undefined) changes.city = input.city || null;
    if (input.bio !== undefined) changes.bio = input.bio || null;
    if (input.preferred_foot !== undefined) changes.preferred_foot = input.preferred_foot;
    if (input.preferred_position !== undefined) changes.preferred_position = input.preferred_position || null;
    if (input.skill_level !== undefined) changes.skill_level = input.skill_level;
    if (input.avatar_url !== undefined) changes.avatar_url = input.avatar_url || null;
    if (input.role === 'player') changes.role = input.role;
    if (input.is_setup_complete === true) changes.is_setup_complete = true;
    return this.repository.updateUser(userId, changes);
  }

  private async toAuthResult(profile: UserProfile): Promise<AuthResult> {
    return {
      user: { id: profile.id, phone: profile.phone, email: profile.email },
      profile,
      session: await this.tokenService.createSession(profile),
    };
  }
}

export { normalizePhone };
