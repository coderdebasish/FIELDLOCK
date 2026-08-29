import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || "fieldlock-playhack-secret-key-2024",
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email / Roll Number", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const rawInput = (credentials.email as string).trim();
          const lowerInput = rawInput.toLowerCase();
          const upperInput = rawInput.toUpperCase();

          // Search by email, roll number (e.g. 220101001 or ADMIN001), or roll email
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: lowerInput },
                { rollNumber: upperInput },
                { rollNumber: rawInput },
                { email: `${lowerInput}@iitg.ac.in` },
              ],
            },
          });

          if (!user || !user.isActive) {
            console.warn(`Auth failed: User not found for input "${rawInput}"`);
            return null;
          }

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!valid) {
            console.warn(`Auth failed: Password invalid for user "${user.email}"`);
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            rollNumber: user.rollNumber,
            allocationScore: user.allocationScore,
          };
        } catch (error) {
          console.error("Authorize error during login:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.rollNumber = (user as { rollNumber: string }).rollNumber;
        token.allocationScore = (user as { allocationScore: number }).allocationScore;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.rollNumber = token.rollNumber as string;
        session.user.allocationScore = token.allocationScore as number;
      }
      return session;
    },
  },
};
