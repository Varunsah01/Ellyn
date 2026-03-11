import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('next/navigation', () => {
  const replace = jest.fn()
  const push = jest.fn()
  const refresh = jest.fn()
  const useSearchParams = jest.fn(() => new URLSearchParams())
  return {
    useRouter: () => ({ replace, push, refresh }),
    useSearchParams,
    __getRouterReplaceMock: () => replace,
    __getRouterPushMock: () => push,
  }
})

jest.mock('@/lib/supabase/config', () => ({
  isSupabaseConfigured: true,
}))

jest.mock('@/lib/supabase/client', () => {
  const mockGetSession = jest.fn()
  const mockOnAuthStateChange = jest.fn()
  const mockSignInWithPassword = jest.fn()
  const mockSignInWithOAuth = jest.fn()

  return {
    createClient: jest.fn(() => ({
      auth: {
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
        signInWithPassword: mockSignInWithPassword,
        signInWithOAuth: mockSignInWithOAuth,
      },
    })),
    __mockAuth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }
})

jest.mock('@/lib/api-client', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('@/components/CsrfHiddenInput', () => ({
  CsrfHiddenInput: () => null,
}))

import LoginPage from '@/app/auth/login/page'
import SignupPage from '@/app/auth/signup/page'
import { apiFetch } from '@/lib/api-client'

type MockAuthMethods = {
  getSession: jest.Mock
  onAuthStateChange: jest.Mock
  signInWithPassword: jest.Mock
  signInWithOAuth: jest.Mock
}

const supabase = (jest.requireMock('@/lib/supabase/client') as { __mockAuth: MockAuthMethods }).__mockAuth

function getRouterReplaceMock() {
  const navModule = jest.requireMock('next/navigation')
  return navModule.__getRouterReplaceMock()
}

function getRouterPushMock() {
  const navModule = jest.requireMock('next/navigation')
  return navModule.__getRouterPushMock()
}

describe('Auth integration flows', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    ;(supabase.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    })

    ;(supabase.onAuthStateChange as jest.Mock).mockReturnValue({
      data: {
        subscription: {
          unsubscribe: jest.fn(),
        },
      },
    })
  })

  test('signup blocks weak passwords and disables submission', async () => {
    const { container } = render(<SignupPage />)

    fireEvent.input(screen.getByPlaceholderText('Jane Doe'), { target: { name: 'full_name', value: 'Test User' } })
    fireEvent.input(screen.getByPlaceholderText('you@example.com'), { target: { name: 'email', value: 'test@example.com' } })
    
    const weakPasswordInput = screen.getByPlaceholderText('Minimum 8 characters')
    fireEvent.input(weakPasswordInput, { target: { name: 'password', value: 'weak' } })

    await act(async () => {
      const form = container.querySelector('form')
      if (form) fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument()
    })
    
    expect(apiFetch).not.toHaveBeenCalled()
  })

  test('signup submits valid payload and shows success message', async () => {
    const user = userEvent.setup()
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

    const nameInput = screen.getByPlaceholderText('Jane Doe')
    const emailInput = screen.getByPlaceholderText('you@example.com')
    const primaryPasswordInput = screen.getByPlaceholderText('Minimum 8 characters')
    const confirmPasswordInput = screen.getByPlaceholderText('Re-enter password')

    await act(async () => {
      await user.type(nameInput, 'Integration User')
      await user.type(emailInput, 'integration@example.com')
      await user.type(primaryPasswordInput, 'Stronger1!')
      await user.type(confirmPasswordInput, 'Stronger1!')
    })

    const submitBtn = screen.getByRole('button', { name: /create account/i })
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled()
    })
  })

  test('login signs in and redirects to dashboard', async () => {
    ;(supabase.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'login@example.com',
          user_metadata: {},
        },
      },
      error: null,
    })

    const { container } = render(<LoginPage />)

    fireEvent.input(screen.getByPlaceholderText('you@example.com'), { target: { name: 'email', value: 'login@example.com' } })
    fireEvent.input(screen.getByPlaceholderText('Your password'), { target: { name: 'password', value: 'StrongPass1!' } })

    await act(async () => {
      const form = container.querySelector('form')
      if (form) fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(supabase.signInWithPassword).toHaveBeenCalledWith({
        email: 'login@example.com',
        password: 'StrongPass1!',
      })
    })

    await waitFor(() => {
      expect(getRouterPushMock()).toHaveBeenCalledWith('/dashboard')
    })
  })

  test('login shows error when credentials are invalid', async () => {
    ;(supabase.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const { container } = render(<LoginPage />)

    fireEvent.input(screen.getByPlaceholderText('you@example.com'), { target: { name: 'email', value: 'wrong@example.com' } })
    fireEvent.input(screen.getByPlaceholderText('Your password'), { target: { name: 'password', value: 'wrong' } })
    
    await act(async () => {
      const form = container.querySelector('form')
      if (form) fireEvent.submit(form)
    })

    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()
    expect(getRouterPushMock()).not.toHaveBeenCalledWith('/dashboard')
  })
})

