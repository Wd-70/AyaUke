'use client'

import Link from "next/link"
import { signIn } from "next-auth/react"
import { useState } from "react"
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { useToast } from "@/components/Toast"

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)
  const { showError } = useToast()

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      const result = await signIn('chzzk', {
        callbackUrl: '/',
        redirect: false
      })

      if (result?.error) {
        console.error('Login error:', result.error)
        if (result.error.includes('승인')) {
          showError('치지직 API 승인이 필요해요', '개발자 콘솔에서 승인 상태를 확인해 주세요.')
        } else {
          showError('로그인에 실패했어요', '잠시 후 다시 시도해 주세요.')
        }
        setIsLoading(false)
      } else if (result?.url) {
        window.location.href = result.url
      }
    } catch (error) {
      console.error('Login error:', error)
      showError('로그인에 실패했어요', '잠시 후 다시 시도해 주세요.')
      setIsLoading(false)
    }
  }

  // 등장 애니메이션은 CSS(anim-*) — 하이드레이션 전에도 카드가 보이도록.
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-950 dark:to-gray-950">
      {/* 배경 블롭 */}
      <div aria-hidden className="absolute inset-0 dark:hidden">
        <div className="animate-blob absolute -left-4 top-0 h-72 w-72 rounded-full bg-light-primary/30 opacity-70 mix-blend-multiply blur-xl" />
        <div className="animate-blob animation-delay-2000 absolute -right-4 top-0 h-72 w-72 rounded-full bg-light-secondary/40 opacity-70 mix-blend-multiply blur-xl" />
        <div className="animate-blob animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 rounded-full bg-light-accent/30 opacity-70 mix-blend-multiply blur-xl" />
      </div>
      <div aria-hidden className="absolute inset-0 hidden dark:block">
        <div className="animate-blob absolute -left-4 top-0 h-72 w-72 rounded-full bg-dark-primary/20 opacity-60 mix-blend-screen blur-xl" />
        <div className="animate-blob animation-delay-2000 absolute -right-4 top-0 h-72 w-72 rounded-full bg-dark-secondary/20 opacity-60 mix-blend-screen blur-xl" />
        <div className="animate-blob animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 rounded-full bg-dark-accent/20 opacity-60 mix-blend-screen blur-xl" />
      </div>

      {/* 로그인 화면에는 내비가 없으므로 돌아갈 길을 준다 */}
      <Link
        href="/"
        className="absolute left-3 top-[max(12px,env(safe-area-inset-top))] z-20 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-white/50 hover:text-light-accent-deep dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-dark-accent"
      >
        <ChevronLeftIcon className="h-4 w-4" aria-hidden />
        홈으로
      </Link>

      <main className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="anim-rise mb-8 text-center" style={{ animationDelay: '60ms' }}>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-light-accent to-light-purple shadow-2xl dark:from-dark-primary dark:to-dark-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/honeyz.png" alt="" className="h-12 w-12 object-contain" />
            </div>
            <h1 className="mb-2 bg-gradient-to-r from-light-title-1 via-light-title-2 to-light-title-3 bg-clip-text text-4xl font-bold text-transparent dark:from-dark-accent dark:via-dark-secondary dark:to-dark-primary">
              아야의 노래책
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              치지직 계정으로 간편하게 로그인하세요
            </p>
          </div>

          <div
            className="anim-rise rounded-3xl border border-gray-200/50 bg-white/70 p-8 shadow-2xl backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-800/30"
            style={{ animationDelay: '160ms' }}
          >
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isLoading}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-light-cta-accent to-light-cta-purple px-8 py-4 font-bold text-white shadow-lg transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:from-dark-primary dark:to-dark-secondary"
            >
              <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              <span className="relative flex items-center justify-center gap-3">
                {isLoading ? (
                  <>
                    <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span className="text-lg">로그인 중…</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg">치지직으로 로그인</span>
                    <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </>
                )}
              </span>
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                로그인하면 좋아요, 플레이리스트, 보관함을<br />
                어느 기기에서나 이어서 쓸 수 있어요
              </p>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">🔒 안전한 OAuth 2.0 인증</p>
            </div>
          </div>

          <p className="anim-fade mt-8 text-center text-sm text-gray-500 dark:text-gray-400" style={{ animationDelay: '300ms' }}>
            계정이 없으신가요?{" "}
            <a
              href="https://chzzk.naver.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-light-accent-deep underline transition-colors hover:text-light-purple dark:text-dark-accent dark:hover:text-dark-primary"
            >
              치지직에서 가입하기
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
