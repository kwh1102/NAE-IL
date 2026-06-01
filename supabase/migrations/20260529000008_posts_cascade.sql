DO $$ 
BEGIN
    -- Drop the foreign key from public.posts referencing auth.users if it exists
    ALTER TABLE IF EXISTS public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
    
    -- Re-add it with ON DELETE CASCADE
    ALTER TABLE IF EXISTS public.posts
    ADD CONSTRAINT posts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Also check for comments table just in case
    ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
    ALTER TABLE IF EXISTS public.comments
    ADD CONSTRAINT comments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Also check for post_likes table
    ALTER TABLE IF EXISTS public.post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
    ALTER TABLE IF EXISTS public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if tables don't exist
    RAISE NOTICE 'An error occurred, likely table does not exist: %', SQLERRM;
END $$;
