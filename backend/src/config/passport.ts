import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env.js';
import { prisma } from '../db/prisma.js';
import { logger } from './logger.js';
import { AuthUser } from '../types/index.js';

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return done(null, null);
    }
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      googleId: user.googleId,
    };
    done(null, authUser);
  } catch (error) {
    done(error, null);
  }
});

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_ID !== 'mock-google-client-id') {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${env.BACKEND_URL}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
          });

          if (!user) {
            // Check if user with same email exists
            user = await prisma.user.findUnique({
              where: { email },
            });

            if (user) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value || user.avatar,
                  name: profile.displayName || user.name,
                },
              });
            } else {
              user = await prisma.user.create({
                data: {
                  googleId: profile.id,
                  email,
                  name: profile.displayName,
                  avatar: profile.photos?.[0]?.value,
                },
              });

              // Create default sender for this user
              await prisma.sender.create({
                data: {
                  userId: user.id,
                  email,
                  name: profile.displayName,
                  hourlyLimit: env.MAX_EMAILS_PER_HOUR,
                  minDelayMs: env.MIN_EMAIL_DELAY_MS,
                },
              });
            }
          }

          const authUser: AuthUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
            googleId: user.googleId,
          };

          return done(null, authUser);
        } catch (error) {
          logger.error({ error }, 'Error in Google OAuth strategy callback');
          return done(error as Error, undefined);
        }
      }
    )
  );
} else {
  logger.warn('Google OAuth credentials not configured. Native Google Sign-In requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.');
}

export default passport;
