import bcrypt from 'bcryptjs'
import { Region } from '@prisma/client'
import { prisma } from '../../shared/utils/prisma.js'

const SALT_ROUNDS = 12

export interface SignupInput {
  email: string
  password: string
  region: Region
}

export interface AuthUser {
  id: string
  email: string
}

export async function signup(input: SignupInput): Promise<AuthUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) {
    throw Object.assign(new Error('Email already registered'), { statusCode: 409 })
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)

  const nextMonthStart = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth() + 1,
    1,
  ))

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      region: input.region,
      preferences: { create: {} },
      capabilities: { create: { resetDate: nextMonthStart } },
    },
    select: { id: true, email: true },
  })

  return user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  })

  // Use constant-time compare even on "user not found" to prevent timing attacks
  const hash = user?.passwordHash ?? '$2b$12$invalidhashpaddingtomakeconst'
  const valid = await bcrypt.compare(password, hash)

  if (!user || !valid) {
    throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 })
  }

  return { id: user.id, email: user.email }
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 })
  return user
}
