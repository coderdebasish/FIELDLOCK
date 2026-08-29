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
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const input = (credentials.email as string).trim();

        // Search by email, rollNumber, or email prefix
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: input },
              { rollNumber: input },
              { email: `${input}@iitg.ac.in` },
            ],
          },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          rollNumber: user.rollNumber,
          allocationScore: user.allocationScore,
        };
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
