/* src/Components/KOS/PresenceIndicator.jsx
 * Shows avatars of users currently on /kos page (from Ably presence).
 * Only renders when realtime.isOnline is true.
 */

import React from 'react';
import { useRealtime } from '../../Realtime/RealtimeProvider';
import { useSession } from '../../Context/SessionContext';
import { User, Users } from 'lucide-react';
import './PresenceIndicator.css';

const PresenceIndicator = () => {
    const { isOnline, presenceMembers } = useRealtime();
    const { session } = useSession();

    // Filter out current user from presence list (optional - we can show all)
    // Match presence members with session data if available
    const getUserDisplayData = (member) => {
        // If this member is the current user, use session data
        if (session && member.data?.userId === session.user_id) {
            return {
                name: session.username || 'You',
                avatar: session.avatar,
                isCurrentUser: true
            };
        }
        // For other users, we only have clientId - use it as fallback
        // In the future, we could enhance presence data to include username/avatar
        return {
            name: member.data?.username || `User ${member.clientId.slice(-4)}`,
            avatar: member.data?.avatar || null,
            isCurrentUser: false
        };
    };

    const onlineUsers = presenceMembers.map(getUserDisplayData);
    const onlineCount = onlineUsers.length;

    if (!isOnline || onlineCount === 0) {
        return null;
    }

    // Show max 5 avatars, rest as "+N"
    const MAX_AVATARS = 5;
    const visibleUsers = onlineUsers.slice(0, MAX_AVATARS);
    const remainingCount = onlineCount - MAX_AVATARS;

    return (
        <div className="presence-indicator" role="group" aria-label={`${onlineCount} ${onlineCount === 1 ? 'user' : 'users'} online`}>
            <div className="presence-avatars" aria-hidden="true">
                {visibleUsers.map((user, index) => (
                    <div
                        key={user.name + index}
                        className={`presence-avatar ${user.isCurrentUser ? 'current-user' : ''}`}
                        title={user.name}
                        style={{ zIndex: MAX_AVATARS - index }}
                    >
                        {user.avatar ? (
                            <img
                                src={user.avatar}
                                alt={user.name}
                                className="presence-avatar-img"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                        ) : null}
                        <div className="presence-avatar-fallback" style={{ display: user.avatar ? 'none' : 'flex' }}>
                            <User size={16} />
                        </div>
                        {user.isCurrentUser && <span className="presence-you-badge" aria-label="You">•</span>}
                    </div>
                ))}
                {remainingCount > 0 && (
                    <div className="presence-avatar presence-more" title={`${remainingCount} more users`}>
                        <span>+{remainingCount}</span>
                    </div>
                )}
            </div>
            <div className="presence-badge">
                <Users size={12} />
                <span>{onlineCount} {onlineCount === 1 ? 'online' : 'online'}</span>
            </div>
        </div>
    );
};

export default PresenceIndicator;