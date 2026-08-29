import { supabase } from "@/lib/Supabase/supabase"
export const auth = {
    // send OTP 
    sendOtp: async (phone: string) => {
        try {

            const { data, error } = await supabase.auth.signInWithOtp({ phone });

            if (error) throw error;

            console.log(data,"SENT")

            return { data, error: null }
        } catch (error: any) {
            console.log(error.message);
            return { data: null, error: error.message }
        }
    },
    verifyOtp: async (phone: string, token: string) => {
        try {

            console.log("Recieved");
            console.log(phone,token);
            const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
            
            if (error) throw error;

            if (data.user) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select("*")
                    .eq('id', data.user.id)
                    .single();



                if (userError && userError.code === 'PGRST116') {
                    // user not found, creat new user
                    const { error: inserError } = await supabase
                        .from('users')
                        .insert({
                            id: data.user.id,
                            phone: data.user.phone,
                            role: '',
                            full_name: '',
                            verified : true
                        })
                        
                    if (inserError) throw inserError;
                }
            }

            return { data, error: null }

        } catch (error: any) {
            console.log(error.message);
            return { data: null, error: error.message }
        }
    },
    getUser: async () => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error) throw error;
            return { user, error: null }
        } catch (error: any) {
            return { user: null, error: error.message }
        }
    },
    getSession: async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            return { session, error: null }
        } catch (error: any) {
            return { session: null, error: error.message }
        }
    },
    signOut: async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { error: null }
        } catch (error: any) {
            return { error: error.message }
        }
    }
}

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Auth event:', event);
    if (event === 'SIGNED_IN') {
        console.log('User signed in:', session?.user?.phone);
    }
    if (event === 'SIGNED_OUT') {
        console.log('User signed out');
    }
    if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
    }
});

// User types
export type UserRole = 'player' | 'vendor' | 'admin' | null;

export interface UserProfile {
    id: string;
    phone: string;
    full_name: string;
    city: string | null;
    role: UserRole;
    avatar_url: string | null;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
}