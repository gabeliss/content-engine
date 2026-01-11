import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import {
  useScheduledPosts,
  ScheduleCalendar,
  ScheduledPostCard,
  EditScheduledModal,
  RescheduleModal,
  ScheduledPost,
} from "../features/scheduling";

export default function Scheduled() {
  const {
    allPosts,
    failedPosts,
    postsByDate,
    datesWithPosts,
    updatePost,
    reschedulePost,
    deletePost,
    postNowAction,
    isLoading,
  } = useScheduledPosts();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showFailedSection, setShowFailedSection] = useState(true);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [reschedulingPost, setReschedulingPost] = useState<ScheduledPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScheduledPost | null>(null);
  const [isPostingNow, setIsPostingNow] = useState<string | null>(null);

  const handleEdit = (post: ScheduledPost) => {
    setEditingPost(post);
  };

  const handleReschedule = (post: ScheduledPost) => {
    setReschedulingPost(post);
  };

  const handlePostNow = async (post: ScheduledPost) => {
    if (!confirm("Post this immediately?")) return;

    setIsPostingNow(post._id);
    try {
      const result = await postNowAction({ id: post._id });
      if (!result.success) {
        alert(result.error || "Failed to post");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setIsPostingNow(null);
    }
  };

  const handleDelete = async (post: ScheduledPost) => {
    if (!confirm("Delete this scheduled post?")) return;

    try {
      await deletePost({ id: post._id });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleSaveEdit = async (data: Parameters<typeof updatePost>[0]) => {
    await updatePost(data);
  };

  const handleSaveReschedule = async (data: Parameters<typeof reschedulePost>[0]) => {
    await reschedulePost(data);
  };

  // Get posts for selected date
  const selectedDateKey = selectedDate.toDateString();
  const postsForSelectedDate = postsByDate?.[selectedDateKey] || [];

  // Get upcoming dates with posts (next 7 days from selected date)
  const upcomingDates: string[] = [];
  if (postsByDate) {
    const sortedDates = Object.keys(postsByDate).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const dateKey of sortedDates) {
      const date = new Date(dateKey);
      if (date >= today) {
        upcomingDates.push(dateKey);
      }
    }
  }

  const formatDateHeader = (dateKey: string) => {
    const date = new Date(dateKey);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    } else {
      return date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Scheduled Posts</h1>
        <p>Manage your upcoming posts</p>
      </div>

      {/* Needs Attention Section */}
      {failedPosts && failedPosts.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: "1.5rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
          }}
        >
          <button
            onClick={() => setShowFailedSection(!showFailedSection)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0",
              textAlign: "left",
            }}
          >
            <AlertCircle size={20} color="#ef4444" />
            <span style={{ fontWeight: 600, color: "#ef4444", flex: 1 }}>
              Needs Attention ({failedPosts.length})
            </span>
            {showFailedSection ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showFailedSection && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginTop: "1rem",
              }}
            >
              {failedPosts.map((post) => (
                <ScheduledPostCard
                  key={post._id}
                  post={post}
                  onEdit={handleEdit}
                  onReschedule={handleReschedule}
                  onPostNow={handlePostNow}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="spinner" style={{ margin: "0 auto" }} />
          <p style={{ color: "#6b7280", marginTop: "1rem" }}>Loading...</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "320px 1fr",
            gap: "1.5rem",
            alignItems: "start",
          }}
        >
          {/* Calendar */}
          <div className="card">
            <ScheduleCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              datesWithPosts={datesWithPosts || new Set()}
            />
          </div>

          {/* Post List */}
          <div className="card">
            {postsForSelectedDate.length > 0 ? (
              <>
                <h2
                  style={{
                    margin: "0 0 1rem 0",
                    fontSize: "1rem",
                    fontWeight: 600,
                  }}
                >
                  {formatDateHeader(selectedDateKey)}
                </h2>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  {postsForSelectedDate.map((post) => (
                    <ScheduledPostCard
                      key={post._id}
                      post={post}
                      onEdit={handleEdit}
                      onReschedule={handleReschedule}
                      onPostNow={handlePostNow}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "#6b7280",
                }}
              >
                <Calendar
                  size={40}
                  style={{ margin: "0 auto 1rem", opacity: 0.5 }}
                />
                <p style={{ margin: 0 }}>
                  No posts scheduled for {formatDateHeader(selectedDateKey)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Posts Summary */}
      {upcomingDates.length > 0 && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 600 }}>
            Upcoming Posts
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {upcomingDates.slice(0, 5).map((dateKey) => {
              const posts = postsByDate?.[dateKey] || [];
              if (posts.length === 0) return null;

              return (
                <div key={dateKey}>
                  <h3
                    style={{
                      margin: "0 0 0.75rem 0",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    {formatDateHeader(dateKey)}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    {posts.map((post) => (
                      <ScheduledPostCard
                        key={post._id}
                        post={post}
                        onEdit={handleEdit}
                        onReschedule={handleReschedule}
                        onPostNow={handlePostNow}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!allPosts || allPosts.length === 0) && (
        <div
          className="card"
          style={{ textAlign: "center", padding: "3rem", marginTop: "1.5rem" }}
        >
          <Calendar size={48} style={{ margin: "0 auto 1rem", opacity: 0.3 }} />
          <h3 style={{ margin: "0 0 0.5rem 0" }}>No scheduled posts yet</h3>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Schedule your first post from the Slideshows page
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editingPost && (
        <EditScheduledModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Reschedule Modal */}
      {reschedulingPost && (
        <RescheduleModal
          post={reschedulingPost}
          onClose={() => setReschedulingPost(null)}
          onSave={handleSaveReschedule}
        />
      )}
    </div>
  );
}
