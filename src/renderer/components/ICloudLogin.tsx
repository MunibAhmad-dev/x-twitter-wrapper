import logoUrl from '../assets/logo.jpeg'
import { useState } from 'react'
import { useUIStore } from '../store/uiStore'
import { useWorkspaceStore } from '../store/workspaceStore'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export function ICloudLogin() {
  const { setCurrentUser, setIsLoggedIn, setActiveWorkspaceId, setCreateWorkspaceModalOpen } = useUIStore()
  const { setWorkspaces, setWorkspaceAccounts } = useWorkspaceStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.auth.login(username, password)

      if (result?.success && result.user) {
        setCurrentUser(result.user)
        setIsLoggedIn(true)

        const workspaces = await window.electronAPI?.workspace.list()
        setWorkspaces(workspaces || [])

        if (workspaces && workspaces.length > 0) {
          setActiveWorkspaceId(workspaces[0].id)
          const accounts = await window.electronAPI?.workspaceAccount.list(workspaces[0].id)
          setWorkspaceAccounts(accounts || [])

          if (accounts && accounts.length > 0) {
            await window.electronAPI?.workspace.loadX(workspaces[0].id, accounts[0].id)
          } else {
            setCreateWorkspaceModalOpen(true)
          }
        } else {
          setCreateWorkspaceModalOpen(true)
        }
      } else {
        setError(result?.error || 'Login failed')
      }
    } catch (err) {
      setError('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async () => {
    setError('')
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.auth.signup(username, password)

      if (result?.success && result.user) {
        setCurrentUser(result.user)
        setIsLoggedIn(true)
        setCreateWorkspaceModalOpen(true)
      } else {
        setError(result?.error || 'Registration failed')
      }
    } catch (err) {
      setError('Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isRegisterMode) {
      handleRegister()
    } else {
      handleLogin()
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-screen w-screen"
      style={{
        background: 'linear-gradient(160deg, #f7f7f8 0%, #eef0f1 50%, #e3e6e8 100%)',
      }}
    >
      <div
        className="max-w-md w-full mx-auto rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px rgba(254,44,85,0.18), 0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid rgba(255,255,255,0.9)',
        }}
      >
        {/* Blue header band */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0a66c2 0%, #1D9BF0 60%, #000000 100%)',
            padding: '36px 32px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <img
            src={logoUrl}
            alt="Apps for X & Twitter"
            style={{
              width: 72, height: 72, borderRadius: '16px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.3)',
              objectFit: 'cover',
            }}
          />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.2,
                letterSpacing: '-0.2px',
              }}
            >
              Apps for X & Twitter
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.2,
                letterSpacing: '-0.2px',
              }}
            >
              Multi-account X workspace
            </div>
          </div>
        </div>

        {/* Form body */}
        <div style={{ padding: '28px 32px 32px' }}>
          <p
            style={{
              textAlign: 'center',
              fontSize: '14px',
              color: '#65676b',
              marginBottom: '20px',
            }}
          >
            {isRegisterMode ? 'Create an account to get started' : 'Sign in to continue'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="username" style={{ color: '#1c1e21', fontWeight: 500 }}>Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                style={{
                  color: '#1c1e21',
                  borderColor: '#dddfe2',
                  borderRadius: '8px',
                  background: '#f5f6f7',
                }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" style={{ color: '#1c1e21', fontWeight: 500 }}>Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  color: '#1c1e21',
                  borderColor: '#dddfe2',
                  borderRadius: '8px',
                  background: '#f5f6f7',
                }}
              />
            </div>

            {error && (
              <p
                style={{
                  fontSize: '13px',
                  color: '#fa3e3e',
                  background: '#fff0f0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  border: '1px solid #ffd0d0',
                }}
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              style={{
                background: 'linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%)',
                color: '#fff',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '15px',
                padding: '12px',
                height: 'auto',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1,
              }}
            >
              {isLoading ? 'Please wait…' : (isRegisterMode ? 'Create Account' : 'Sign In')}
            </Button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Button
              variant="link"
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              style={{ color: '#1D9BF0', fontWeight: 500, fontSize: '13px' }}
            >
              {isRegisterMode
                ? 'Already have an account? Sign in'
                : "Don't have an account? Register"}
            </Button>
          </div>

          <p
            style={{
              textAlign: 'center',
              fontSize: '11px',
              color: '#8a8d91',
              marginTop: '20px',
              lineHeight: 1.5,
            }}
          >
            Not affiliated with X Corp.
          </p>
        </div>
      </div>
    </div>
  )
}