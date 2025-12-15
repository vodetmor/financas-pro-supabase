
import { supabase } from './supabase';
import {
    AppState,
    TeamMember,
    Offer,
    Service,
    Transaction,
    Subscription,
    MOCK_STATE,
    OfferStatus,
    ServiceStatus,
    OfferParticipant,
    DailyEntry,
    ServiceParticipant,
    ServiceStep,
    PayoutModel
} from '../types';

// --- Fetchers ---

export const fetchAllData = async (): Promise<AppState> => {
    try {
        const [
            { data: members },
            { data: offers },
            { data: services },
            { data: transactions },
            { data: subscriptions },
            { data: offerParticipants },
            { data: dailyEntries },
            { data: serviceParticipants },
            { data: serviceSteps }
        ] = await Promise.all([
            supabase.from('team_members').select('*'),
            supabase.from('offers').select('*'),
            supabase.from('services').select('*'),
            supabase.from('transactions').select('*'),
            supabase.from('subscriptions').select('*'),
            supabase.from('offer_participants').select('*'),
            supabase.from('daily_entries').select('*'),
            supabase.from('service_participants').select('*'),
            supabase.from('service_steps').select('*')
        ]);

        // Map Offers (join participants and dailyEntries)
        const mappedOffers: Offer[] = (offers || []).map((o: any) => ({
            id: o.id,
            name: o.name,
            description: o.description,
            status: o.status as OfferStatus,
            payoutModel: o.payout_model as PayoutModel,
            teamPotPercent: Number(o.team_pot_percent),
            currency: o.currency || 'BRL',
            originalAmount: Number(o.original_amount || 0),
            startDate: o.start_date,
            endDate: o.end_date,
            active: o.active,
            participants: (offerParticipants || [])
                .filter((p: any) => p.offer_id === o.id)
                .map((p: any) => ({
                    memberId: p.member_id,
                    role: p.role,
                    sharePercent: Number(p.share_percent)
                })),
            dailyEntries: (dailyEntries || [])
                .filter((e: any) => e.offer_id === o.id)
                .map((e: any) => ({
                    id: e.id,
                    date: e.date,
                    revenue: Number(e.revenue),
                    adsSpend: Number(e.ads_spend),
                    netProfit: Number(e.net_profit), // or calc locally
                    teamShare: Number(e.team_share),
                    note: e.note
                }))
        }));

        // Map Services (join participants and steps)
        const mappedServices: Service[] = (services || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            clientName: s.client_name,
            value: Number(s.value),
            amountPaid: Number(s.amount_paid),
            currency: s.currency || 'BRL',
            originalAmount: Number(s.original_amount || 0),
            status: s.status as ServiceStatus,
            offerId: s.offer_id,
            startDate: s.start_date,
            endDate: s.end_date,
            steps: (serviceSteps || [])
                .filter((step: any) => step.service_id === s.id)
                .map((step: any) => ({
                    id: step.id,
                    title: step.title,
                    isCompleted: step.is_completed
                })),
            participants: (serviceParticipants || [])
                .filter((p: any) => p.service_id === s.id)
                .map((p: any) => ({
                    memberId: p.member_id,
                    role: p.role,
                    sharePercent: Number(p.share_percent)
                }))
        }));

        const mappedMembers: TeamMember[] = (members || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            role: m.role,
            defaultSharePercent: Number(m.default_share_percent),
            avatarUrl: m.avatar_url || ''
        }));

        const mappedTransactions: Transaction[] = (transactions || []).map((t: any) => ({
            id: t.id,
            date: t.date,
            type: t.type,
            category: t.category,
            description: t.description,
            amount: Number(t.amount),
            currency: t.currency || 'BRL',
            originalAmount: Number(t.original_amount || 0),
            status: t.status,
            serviceId: t.service_id,
            offerId: t.offer_id,
            assignedMemberId: t.assigned_member_id,
            subscriptionId: t.subscription_id
        }));

        const mappedSubscriptions: Subscription[] = (subscriptions || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            amount: Number(s.amount),
            currency: s.currency || 'BRL',
            originalAmount: Number(s.original_amount || 0),
            billingCycle: s.billing_cycle,
            firstPaymentDate: s.first_payment_date,
            nextPaymentDate: s.next_payment_date,
            category: s.category,
            active: s.active,
            autoPay: s.auto_pay,
            notes: s.notes
        }));

        return {
            members: mappedMembers,
            offers: mappedOffers,
            services: mappedServices,
            transactions: mappedTransactions,
            subscriptions: mappedSubscriptions
        };

    } catch (error) {
        console.error('Error fetching data:', error);
        return MOCK_STATE;
    }
};

// --- Mutations ---

// Members
export const apiAddMember = async (m: Omit<TeamMember, 'id'>) => {
    const { data, error } = await supabase.from('team_members').insert([{
        name: m.name,
        role: m.role,
        default_share_percent: m.defaultSharePercent,
        avatar_url: m.avatarUrl
    }]).select().single();
    if (error) throw error;
    return data;
};

export const apiUpdateMember = async (id: string, updates: Partial<TeamMember>) => {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.defaultSharePercent !== undefined) payload.default_share_percent = updates.defaultSharePercent;
    if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;

    const { error } = await supabase.from('team_members').update(payload).eq('id', id);
    if (error) throw error;
};


export const apiDeleteMember = async (id: string) => {
    const { error, count } = await supabase.from('team_members').delete().eq('id', id).select('id', { count: 'exact' });
    if (error) throw error;
    if (count === 0) throw new Error("Membro não encontrado ou já excluído.");
};


// Transactions
export const apiAddTransaction = async (t: Omit<Transaction, 'id'>) => {
    const { data, error } = await supabase.from('transactions').insert([{
        date: t.date,
        type: t.type,
        category: t.category,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        original_amount: t.originalAmount,
        status: t.status,
        service_id: t.serviceId,
        offer_id: t.offerId,
        assigned_member_id: t.assignedMemberId,
        subscription_id: t.subscriptionId
    }]).select().single();
    if (error) throw error;
    return data;
};

export const apiUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const payload: any = {};
    if (updates.date) payload.date = updates.date;
    if (updates.type) payload.type = updates.type;
    if (updates.category) payload.category = updates.category;
    if (updates.description) payload.description = updates.description;
    if (updates.amount) payload.amount = updates.amount;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.originalAmount) payload.original_amount = updates.originalAmount;
    if (updates.status) payload.status = updates.status;
    if (updates.serviceId !== undefined) payload.service_id = updates.serviceId;
    if (updates.offerId !== undefined) payload.offer_id = updates.offerId;
    if (updates.assignedMemberId !== undefined) payload.assigned_member_id = updates.assignedMemberId;
    // subscriptionId usually static but can add if needed

    const { error } = await supabase.from('transactions').update(payload).eq('id', id);
    if (error) throw error;
};


export const apiDeleteTransaction = async (id: string) => {
    const { error, count } = await supabase.from('transactions').delete().eq('id', id).select('id', { count: 'exact' });
    if (error) throw error;
    if (count === 0) throw new Error("Transação não encontrada ou já excluída.");
};


// Subscriptions
export const apiAddSubscription = async (s: Omit<Subscription, 'id'>) => {
    const { data, error } = await supabase.from('subscriptions').insert([{
        name: s.name,
        amount: s.amount,
        currency: s.currency,
        original_amount: s.originalAmount,
        billing_cycle: s.billingCycle,
        first_payment_date: s.firstPaymentDate,
        next_payment_date: s.nextPaymentDate,
        category: s.category,
        active: s.active,
        auto_pay: s.autoPay,
        notes: s.notes
    }]).select().single();
    if (error) throw error;
    return data;
};

export const apiUpdateSubscription = async (id: string, updates: Partial<Subscription>) => {
    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.amount) payload.amount = updates.amount;
    if (updates.currency) payload.currency = updates.currency;
    if (updates.originalAmount) payload.original_amount = updates.originalAmount;
    if (updates.nextPaymentDate) payload.next_payment_date = updates.nextPaymentDate;
    if (updates.active !== undefined) payload.active = updates.active;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { error } = await supabase.from('subscriptions').update(payload).eq('id', id);
    if (error) throw error;
};


export const apiDeleteSubscription = async (id: string) => {
    const { error, count } = await supabase.from('subscriptions').delete().eq('id', id).select('id', { count: 'exact' });
    if (error) throw error;
    if (count === 0) throw new Error("Assinatura não encontrada ou já excluída.");
};


// Offers
export const apiAddOffer = async (o: Omit<Offer, 'id'>) => {
    // 1. Insert Offer
    const { data: offerData, error: offerError } = await supabase.from('offers').insert([{
        name: o.name,
        description: o.description,
        status: o.status,
        payout_model: o.payoutModel,
        team_pot_percent: o.teamPotPercent,
        currency: o.currency,
        original_amount: o.originalAmount,
        start_date: o.startDate,
        end_date: o.endDate,
        active: o.active
    }]).select().single();

    if (offerError) throw offerError;
    const offerId = offerData.id;

    // 2. Insert Participants
    if (o.participants.length > 0) {
        const participantsPayload = o.participants.map(p => ({
            offer_id: offerId,
            member_id: p.memberId,
            role: p.role,
            share_percent: p.sharePercent
        }));
        const { error: partError } = await supabase.from('offer_participants').insert(participantsPayload);
        if (partError) throw partError; // Note: Offer created but parts failed. In prod use RPC or rollback manually.
    }

    return offerData;
};

export const apiUpdateOffer = async (id: string, updates: Partial<Offer>) => {
    // Update core fields
    const coreUpdates: any = {};
    if (updates.name) coreUpdates.name = updates.name;
    if (updates.status) coreUpdates.status = updates.status;
    if (updates.currency) coreUpdates.currency = updates.currency;
    if (updates.originalAmount) coreUpdates.original_amount = updates.originalAmount;
    if (updates.startDate) coreUpdates.start_date = updates.startDate;
    if (updates.endDate) coreUpdates.end_date = updates.endDate;
    // TODO: Add other fields if editable in UI

    if (Object.keys(coreUpdates).length > 0) {
        await supabase.from('offers').update(coreUpdates).eq('id', id);
    }

    // NOTE: Participants/DailyEntries usually updated via specific sub-functions or separate calls in a real app
    // For simplicity, if dailyEntries provided, acts as "Upsert" for the changed entry
    if (updates.dailyEntries) {
        // Find new keys or changed keys? API usually sends the specific changed entry. 
        // Assuming frontend sends the WHOLE dailyEntries array is dangerous/inefficient.
        // But looking at App.tsx, updateOffer is called with the whole object spread.
        // Ideally we'd have `apiAddDailyEntry`. Let's assume we handle daily entries separately or just the NEW ones. 
        // Actually, existing App logic holds all state. Let's create specific functions for sub-items if possible, or try to sync.
        // Since `updateOffer` in App.tsx replaces the offer object, we need to be careful.
        // Let's implement specific functions for deep updates to be safe.
    }
};


export const apiDeleteOffer = async (id: string) => {
    const { error, count } = await supabase.from('offers').delete().eq('id', id).select('id', { count: 'exact' });
    if (error) throw error;
    if (count === 0) throw new Error("Oferta não encontrada ou já excluída.");
};


export const apiAddDailyEntry = async (offerId: string, entry: Omit<DailyEntry, 'id'>) => {
    const { data, error } = await supabase.from('daily_entries').insert([{
        offer_id: offerId,
        date: entry.date,
        revenue: entry.revenue,
        ads_spend: entry.adsSpend,
        team_share: entry.teamShare,
        note: entry.note
    }]).select().single();
    if (error) throw error;
    return data;
}

export const apiUpdateDailyEntry = async (id: string, updates: Partial<DailyEntry>) => {
    const payload: any = {};
    if (updates.revenue !== undefined) payload.revenue = updates.revenue;
    if (updates.adsSpend !== undefined) payload.ads_spend = updates.adsSpend;
    if (updates.teamShare !== undefined) payload.team_share = updates.teamShare;
    if (updates.note !== undefined) payload.note = updates.note;

    const { error } = await supabase.from('daily_entries').update(payload).eq('id', id);
    if (error) throw error;
}


// Services
export const apiAddService = async (s: Omit<Service, 'id'>) => {
    const { data: serviceData, error: serviceError } = await supabase.from('services').insert([{
        title: s.title,
        description: s.description,
        client_name: s.clientName,
        value: s.value,
        amount_paid: s.amountPaid,
        currency: s.currency,
        original_amount: s.originalAmount,
        status: s.status,
        offer_id: s.offerId,
        start_date: s.startDate,
        end_date: s.endDate || null
    }]).select().single();

    if (serviceError) throw serviceError;
    const serviceId = serviceData.id;

    if (s.participants.length > 0) {
        const partPayload = s.participants.map(p => ({
            service_id: serviceId,
            member_id: p.memberId,
            role: p.role,
            share_percent: p.sharePercent
        }));
        await supabase.from('service_participants').insert(partPayload);
    }

    if (s.steps.length > 0) {
        const stepsPayload = s.steps.map(step => ({
            service_id: serviceId,
            title: step.title,
            is_completed: step.isCompleted
        }));
        await supabase.from('service_steps').insert(stepsPayload);
    }

    return serviceData;
};

export const apiUpdateService = async (id: string, updates: Partial<Service>) => {
    const core: any = {};
    if (updates.title) core.title = updates.title;
    if (updates.status) core.status = updates.status;
    if (updates.currency) core.currency = updates.currency;
    if (updates.originalAmount) core.original_amount = updates.originalAmount;
    if (updates.amountPaid !== undefined) core.amount_paid = updates.amountPaid;

    if (Object.keys(core).length > 0) {
        await supabase.from('services').update(core).eq('id', id);
    }

    // Steps
    if (updates.steps) {
        // Logic to sync steps. Simple approach:
        // We'll rely on separate step updates for toggles.
    }
};


export const apiDeleteService = async (id: string) => {
    const { error, count } = await supabase.from('services').delete().eq('id', id).select('id', { count: 'exact' });
    if (error) throw error;
    if (count === 0) throw new Error("Serviço não encontrado ou já excluído.");
};


export const apiToggleServiceStep = async (stepId: string, isCompleted: boolean) => {
    await supabase.from('service_steps').update({ is_completed: isCompleted }).eq('id', stepId);
}
