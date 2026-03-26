import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtime(table, filter, queryKey) {
    const queryClient = useQueryClient();

    useEffect(() => {
        const channel = supabase
            .channel(`realtime_${table}_${filter}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table,
                    filter: filter,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [table, filter, queryKey, queryClient]);
}
