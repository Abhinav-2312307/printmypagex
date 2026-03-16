import OwnerBadge from "@/components/OwnerBadge"
import ProfileAvatar from "@/components/ProfileAvatar"
import { isOwnerEmail } from "@/lib/owner-access"

type ProfileCardData = {
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  year?: string | number
  section?: string
  photoURL?: string
  firebasePhotoURL?: string
  displayPhotoURL?: string
  isOwner?: boolean
}

type ProfileCardProps = {
  title: string
  profile: ProfileCardData | null | undefined
}

export default function ProfileCard({ title, profile }: ProfileCardProps) {
  const name = profile?.name || "Unknown"
  const resolvedPhotoURL =
    profile?.displayPhotoURL ||
    profile?.photoURL ||
    profile?.firebasePhotoURL ||
    ""
  const isOwner = Boolean(profile?.isOwner || isOwnerEmail(profile?.email))

  const details = [
    { label: "Email", value: profile?.email },
    { label: "Phone", value: profile?.phone },
    { label: "Roll No", value: profile?.rollNo },
    { label: "Branch", value: profile?.branch },
    { label: "Section", value: profile?.section },
    { label: "Year", value: profile?.year }
  ].filter((detail) => detail.value)

  if (!profile) return null

  return (
    <div
      className={`relative overflow-hidden rounded-[1.7rem] border p-[1px] ${
        isOwner
          ? "border-amber-300/35 bg-[linear-gradient(135deg,rgba(255,228,159,0.22),rgba(245,158,11,0.08),rgba(255,242,195,0.18))] shadow-[0_16px_36px_rgba(245,158,11,0.1)]"
          : "border-white/10 bg-white/5"
      }`}
    >
      {isOwner ? (
        <>
          <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-amber-300/18 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-yellow-200/8 blur-3xl" />
        </>
      ) : null}

      <div
        className={`relative rounded-[calc(1.7rem-1px)] p-5 ${
          isOwner
            ? "bg-[linear-gradient(180deg,rgba(20,18,12,0.96),rgba(15,12,7,0.98))]"
            : "bg-[#0f1422]/92"
        }`}
      >
        <p className="mb-4 text-center text-xs uppercase tracking-[0.28em] text-gray-400">{title}</p>

        <div className="mb-4 flex justify-center">
          <ProfileAvatar
            name={name}
            photoURL={resolvedPhotoURL}
            alt={name}
            isOwner={isOwner}
            className="h-24 w-24 rounded-full"
            initialsClassName="text-3xl"
          />
        </div>

        <div className="mb-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h3
              className={`${
                isOwner
                  ? "text-2xl font-semibold text-amber-100"
                  : "text-xl font-semibold text-white"
              }`}
            >
              {name}
            </h3>
            <OwnerBadge email={profile.email} isOwner={isOwner} />
          </div>

          <p className={`mt-2 text-sm ${isOwner ? "text-amber-100/70" : "text-gray-400"}`}>
            {isOwner ? "Platform owner profile." : "Verified profile details"}
          </p>
        </div>

        <div className="grid gap-3 text-sm">
          {details.map((detail) => (
            <div
              key={detail.label}
              className={`rounded-2xl border px-4 py-3 ${
                isOwner
                  ? "border-amber-200/20 bg-amber-50/[0.045]"
                  : "border-white/8 bg-white/[0.03]"
              }`}
            >
              <p className={`text-[11px] uppercase tracking-[0.22em] ${isOwner ? "text-amber-200/70" : "text-gray-400"}`}>
                {detail.label}
              </p>
              <p className={`mt-1 break-all ${isOwner ? "text-amber-50" : "text-white"}`}>{detail.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
