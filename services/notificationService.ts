/**
 * Admin Notification Service
 * 
 * Handles in-app notifications for payment verification and other critical events.
 * Notifies Harare and Bulawayo admins based on branch_id.
 */

interface AdminNotificationPayload {
  type: 'payment_verification_needed' | 'paynow_payment_received' | 'reservation_expiring';
  reservation_id: string;
  branch_id: 'harare' | 'bulawayo';
  stand_number: string;
  amount: number;
  payment_method?: string;
  client_name?: string;
  client_email?: string;
  expires_at?: string;
}

interface NotificationRecord {
  id?: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at?: string;
}

/**
 * Get admin users for specific branch
 */
const getBranchAdmins = async (branchId: string): Promise<string[]> => {
  // TODO: Fetch from Supabase users table where role = 'admin' and branch_id = branchId
  // const { data, error } = await supabase
  //   .from('users')
  //   .select('id')
  //   .eq('role', 'admin')
  //   .eq('branch_id', branchId);
  
  console.log('[FORENSIC][FETCH_BRANCH_ADMINS]', {
    branch_id: branchId,
    timestamp: new Date().toISOString()
  });

  // Mock admin IDs for development
  return branchId === 'harare' 
    ? ['admin-harare-1', 'admin-harare-2']
    : ['admin-bulawayo-1', 'admin-bulawayo-2'];
};

/**
 * Create notification record in database
 */
const createNotification = async (notification: NotificationRecord): Promise<void> => {
  // TODO: Insert into Supabase notifications table
  // const { error } = await supabase
  //   .from('notifications')
  //   .insert(notification);

  console.log('[FORENSIC][NOTIFICATION_CREATED]', {
    user_id: notification.user_id,
    type: notification.type,
    title: notification.title,
    timestamp: new Date().toISOString()
  });
};

/**
 * Trigger admin notification for payment verification
 */
export const triggerAdminNotification = async (
  payload: AdminNotificationPayload
): Promise<{ success: boolean; error?: string }> => {
  console.log('[FORENSIC][ADMIN_NOTIFICATION_TRIGGER]', {
    type: payload.type,
    reservation_id: payload.reservation_id,
    branch_id: payload.branch_id,
    stand_number: payload.stand_number,
    amount: payload.amount,
    timestamp: new Date().toISOString()
  });

  try {
    // Get admins for the branch
    const adminIds = await getBranchAdmins(payload.branch_id);

    if (adminIds.length === 0) {
      throw new Error(`No admins found for branch: ${payload.branch_id}`);
    }

    // Create notification content based on type
    let title: string;
    let message: string;

    switch (payload.type) {
      case 'payment_verification_needed':
        title = '💰 Payment Verification Required';
        message = `Stand ${payload.stand_number}: ${payload.payment_method} payment of $${payload.amount.toLocaleString()} needs verification. Timer paused.`;
        break;

      case 'paynow_payment_received':
        title = '✅ Paynow Payment Received';
        message = `Stand ${payload.stand_number}: Paynow payment of $${payload.amount.toLocaleString()} confirmed. Ready for AOS generation.`;
        break;

      case 'reservation_expiring':
        title = '⏰ Reservation Expiring Soon';
        message = `Stand ${payload.stand_number}: Less than 6 hours remaining. Client: ${payload.client_name || 'Unknown'}`;
        break;

      default:
        title = '📋 New Notification';
        message = `Stand ${payload.stand_number} requires attention`;
    }

    // Create notifications for all branch admins
    const notificationPromises = adminIds.map(adminId =>
      createNotification({
        user_id: adminId,
        type: payload.type,
        title,
        message,
        data: {
          reservation_id: payload.reservation_id,
          stand_number: payload.stand_number,
          branch_id: payload.branch_id,
          amount: payload.amount,
          payment_method: payload.payment_method,
          client_email: payload.client_email
        },
        read: false
      })
    );

    await Promise.all(notificationPromises);

    console.log('[FORENSIC][ADMIN_NOTIFICATION_SUCCESS]', {
      type: payload.type,
      admin_count: adminIds.length,
      branch_id: payload.branch_id,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('[FORENSIC][ADMIN_NOTIFICATION_ERROR]', {
      type: payload.type,
      reservation_id: payload.reservation_id,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Notification failed'
    };
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  // TODO: Update Supabase notifications table
  // const { error } = await supabase
  //   .from('notifications')
  //   .update({ read: true, read_at: new Date().toISOString() })
  //   .eq('id', notificationId);

  console.log('[FORENSIC][NOTIFICATION_READ]', {
    notification_id: notificationId,
    timestamp: new Date().toISOString()
  });
};

/**
 * Get unread notification count for user
 */
export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  // TODO: Count from Supabase notifications table
  // const { count, error } = await supabase
  //   .from('notifications')
  //   .select('*', { count: 'exact', head: true })
  //   .eq('user_id', userId)
  //   .eq('read', false);

  console.log('[FORENSIC][NOTIFICATION_COUNT_CHECK]', {
    user_id: userId,
    timestamp: new Date().toISOString()
  });

  // Mock count for development
  return 3;
};

/**
 * Fetch notifications for user
 */
export const fetchUserNotifications = async (
  userId: string,
  limit: number = 10
): Promise<NotificationRecord[]> => {
  // TODO: Fetch from Supabase notifications table
  // const { data, error } = await supabase
  //   .from('notifications')
  //   .select('*')
  //   .eq('user_id', userId)
  //   .order('created_at', { ascending: false })
  //   .limit(limit);

  console.log('[FORENSIC][NOTIFICATIONS_FETCH]', {
    user_id: userId,
    limit,
    timestamp: new Date().toISOString()
  });

  // Mock notifications for development
  return [
    {
      id: '1',
      user_id: userId,
      type: 'payment_verification_needed',
      title: '💰 Payment Verification Required',
      message: 'Stand 103: Bank Transfer payment of $15,000 needs verification.',
      data: { stand_number: '103' },
      read: false,
      created_at: new Date().toISOString()
    }
  ];
};
