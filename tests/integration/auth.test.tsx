import { fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('next/navigation', () => {
  const replace = jest.fn()

  return {
    useRouter: () => ({
      replace,
    }),
    useSearchParams: () => new URLSearchParams(),
    __mocks: {
      replace,
    },
  }
})

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
    },
  },
}))

jest.mock('@/lib/api-client', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('@/components/CsrfHiddenInput', () => ({
  CsrfHiddenInput: () => null,
}))

import LoginPage from '@/app/auth/login/page'
import SignupPage from '@/app/auth/signup/page'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api-client'

function getRouterReplaceMock(): jest.Mock {
  const navModule = jest.requireMock('next/navigation') as {
    __mocks: { replace: jest.Mock }
  }
  return navModule.__mocks.replace
}

describe('Auth integration flows', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    ;(supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    })

    ;(supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    })
  })

  test('signup blocks weak passwords and disables submission', () => {
    render(<SignupPage />)

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Test User' },
    })
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    })
    const weakPasswordInput = screen.getAllByPlaceholderText('********')[0]
    if (!weakPasswordInput) {
      throw new Error('Expected password input to be present')
    }
    fireEvent.change(weakPasswordInput, {
      target: { value: 'weak' },
    })

    const submitButton = screen.getByRole('button', { name: /create account/i })
    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/minimum 8 characters/i)).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('signup submits valid payload and shows success message', async () => {
    ;(apiFetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hasSession: false,
          message: 'Account created. Check your email.',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    render(<SignupPage />)

    fireEvent.change(screen.getByPlaceholderText('John Doe'), {
      target: { value: 'Integration User' },
    })
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'integration@example.com' },
    })
    const signupPasswordInputs = screen.getAllByPlaceholderText('********')
    const primaryPasswordInput = signupPasswordInputs[0]
    const confirmPasswordInput = signupPasswordInputs[1]
    if (!primaryPasswordInput || !confirmPasswordInput) {
      throw new Error('Expected password and confirmation inputs to be present')
    }
    fireEvent.change(primaryPasswordInput, {
      target: { value: 'Stronger1!' },
    })
    fireEvent.change(confirmPasswordInput, {
      target: { value: 'Stronger1!' },
    })
    fireEvent.click(screen.getByLabelText(/i agree to the/i))

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/auth/signup',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    expect(await screen.findByText(/account created\. check your email/i)).toBeInTheDocument()
  })

  test('login signs in and redirects to dashboard', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'login@example.com',
          user_metadata: {},
        },
      },
      error: null,
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'login@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('********'), {
      target: { value: 'StrongPass1!' },
    })

    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'login@example.com',
        password: 'StrongPass1!',
      })
    })

    await waitFor(() => {
      expect(getRouterReplaceMock()).toHaveBeenCalledWith('/dashboard')
    })
  })

  test('login shows error when credentials are invalid', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('********'), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()
    expect(getRouterReplaceMock()).not.toHaveBeenCalledWith('/dashboard')
  })
})
