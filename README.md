# Mockly AI — Mock Interview Platform

An AI-powered mock interview platform built with Next.js and Firebase. Upload your resume, pick a job role, and get AI-generated interview questions asked aloud by the browser. Your spoken answers are evaluated in real time using Google Gemini.

## Features

- Voice-based interview with speech recognition
- Resume upload and parsing (PDF)
- AI-generated questions tailored to your job role and experience level
- Leaderboard with technical and HR score breakdown
- Tab-switch cheat detection
- Hindi language detection with English prompt
- Google and email/password auth

## Stack

- **Frontend:** Next.js 15, Tailwind CSS
- **Backend/DB:** Firebase (Firestore, Auth, Storage)
- **AI:** Google Gemini 2.5 Flash

## Setup

1. Clone the repo
2. Copy `.env.local.example` to `.env.local` and fill in your Firebase + Gemini keys
3. Run `npm install`
4. Run `npm run dev`

Open [http://localhost:3000](http://localhost:3000) to see it running.

## Notes

- Only Gmail accounts are allowed for Google sign-in
- Resume limit is 5 per user
- Silence for 5 seconds auto-submits the current answer
