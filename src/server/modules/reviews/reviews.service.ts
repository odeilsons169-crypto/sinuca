
export interface Review {
    id: string;
    userId?: string;
    username: string;
    userAvatar?: string; // Optional avatar
    game: string;
    rating: number; // 1-5
    comment: string;
    createdAt: string;
}

// In-memory storage with initial data matching the landing page mocks
const reviews: Review[] = [
    {
        id: '1',
        username: 'Carlos Silva',
        game: 'sinuca',
        rating: 5,
        comment: 'A física das bolas é impressionante, muito parecida com a mesa real. O modo aposta adiciona uma emoção extra!',
        createdAt: new Date().toISOString()
    },
    {
        id: '2',
        username: 'Mariana Costa',
        game: 'sinuca',
        rating: 5,
        comment: 'Melhor plataforma para jogar com amigos. O sistema de criação de salas privadas é super rápido.',
        createdAt: new Date().toISOString()
    },
    {
        id: '3',
        username: 'Roberto M.',
        game: 'sinuca',
        rating: 4,
        comment: 'Ansioso p/ o Truco! Plataforma top.',
        createdAt: new Date().toISOString()
    }
];

export const reviewsService = {
    async create(data: Omit<Review, 'id' | 'createdAt'>) {
        const review: Review = {
            id: Math.random().toString(36).substr(2, 9),
            ...data,
            createdAt: new Date().toISOString()
        };

        // Add to beginning
        reviews.unshift(review);

        // Limit to 50
        if (reviews.length > 50) {
            reviews.pop();
        }

        return review;
    },

    async list(limit = 10) {
        return reviews.slice(0, limit);
    }
};
