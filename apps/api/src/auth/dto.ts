import { IsBoolean, IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 256)
  password!: string;
}

export class VerifyTotpDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsBoolean()
  rememberDevice?: boolean;
}

export class EnrollTotpConfirmDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ChangePasswordDto {
  @IsString()
  @Length(8, 256)
  currentPassword!: string;

  @IsString()
  @Length(12, 256)
  @Matches(/[A-Z]/, { message: 'Needs uppercase' })
  @Matches(/[a-z]/, { message: 'Needs lowercase' })
  @Matches(/\d/, { message: 'Needs digit' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Needs symbol' })
  newPassword!: string;
}
