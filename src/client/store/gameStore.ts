// Store global do jogo (estado da aplicação)

export interface User {
  id: string;
  email: string;
  username: string;
  fullname: string | null;
  cpf: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'user' | 'moderator' | 'admin' | 'super_admin';
  status: 'active' | 'suspended' | 'banned';
  is_admin?: boolean;
  // Localização
  country_code: string | null;
  country_name: string | null;
  state_code: string | null;
  state_name: string | null;
  city: string | null;
  // Sistema de Níveis
  level: number;
  xp: number;
  xp_to_next_level: number;
  total_xp: number;
}

export interface GameState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Wallet & Credits
  balance: number;
  credits: number;
  isUnlimited: boolean;

  // Room & Match
  currentRoom: any | null;
  currentMatch: any | null;

  // UI
  currentScreen: 'login' | 'register' | 'lobby' | 'room' | 'match' | 'profile' | 'ranking';
  error: string | null;
  notification: string | null;
}

class GameStore {
  private state: GameState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    balance: 0,
    credits: 0,
    isUnlimited: false,
    currentRoom: null,
    currentMatch: null,
    currentScreen: 'login',
    error: null,
    notification: null,
  };

  private listeners: Set<(state: GameState) => void> = new Set();

  getState(): GameState {
    return { ...this.state };
  }

  setState(partial: Partial<GameState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener: (state: GameState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  // Actions
  setUser(user: User | null) {
    this.setState({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      currentScreen: user ? 'lobby' : 'login',
    });
  }

  setWallet(balance: number) {
    this.setState({ balance });
  }

  setCredits(credits: number, isUnlimited: boolean) {
    this.setState({ credits, isUnlimited });
  }

  setRoom(room: any | null) {
    this.setState({
      currentRoom: room,
      currentScreen: room ? 'room' : 'lobby',
    });
  }

  setMatch(match: any | null) {
    this.setState({
      currentMatch: match,
      currentScreen: match ? 'match' : 'room',
    });
  }

  setScreen(screen: GameState['currentScreen']) {
    this.setState({ currentScreen: screen });
  }

  setError(error: string | null) {
    this.setState({ error });
    if (error) {
      setTimeout(() => this.setState({ error: null }), 5000);
    }
  }

  setNotification(notification: string | null) {
    this.setState({ notification });
    if (notification) {
      setTimeout(() => this.setState({ notification: null }), 3000);
    }
  }

  logout() {
    this.setState({
      user: null,
      isAuthenticated: false,
      balance: 0,
      credits: 0,
      isUnlimited: false,
      currentRoom: null,
      currentMatch: null,
      currentScreen: 'login',
    });
  }
}

export const gameStore = new GameStore();
