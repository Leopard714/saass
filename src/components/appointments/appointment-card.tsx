"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  SpinnerGapIcon,
} from "@/components/icons"
import { format, parse } from "date-fns"
import {
  cancelAppointment,
  getAvailableTimeSlots,
  rescheduleAppointment,
} from "@/app/actions/appointments"
import { AppointmentCardProps, TimeSlot } from "@/lib/interfaces"
import Link from "next/link"
import { RescheduleDialog } from "@/components/appointments/reschedule-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export function AppointmentCard({
  appointment,
  isPast = false,
  isNew = false,
}: AppointmentCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // dialogs
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const totalDuration = appointment.services.reduce(
    (sum, s) => sum + s.service.duration,
    0
  )

  // availability
  const handleDateChange = async (date: Date) => {
    setLoadingSlots(true)
    const slots = await getAvailableTimeSlots(
      appointment.staff.id,
      date,
      totalDuration
    )
    setAvailableSlots(slots)
    setLoadingSlots(false)
  }

  // reschedule
  const handleReschedule = (newDate: Date, newTime: string) => {
    startTransition(async () => {
      setError(null)
      const newStartTime = parse(newTime, "HH:mm", newDate)
      const result = await rescheduleAppointment(appointment.id, newStartTime)

      if (result.success) {
        setRescheduleOpen(false)
        router.refresh()
      } else {
        setError(result.error || "Failed to reschedule")
      }
    })
  }

  // ❌ Stripe removed → payment disabled
  const handlePayNow = () => {
    setError("Payments are currently disabled.")
  }

  // cancel
  const handleCancelAppointment = () => {
    startTransition(async () => {
      setError(null)
      const result = await cancelAppointment(appointment.id)

      if (result.success) {
        setCancelDialogOpen(false)
        router.refresh()
      } else {
        setError(result.error || "Failed to cancel appointment")
        setCancelDialogOpen(false)
      }
    })
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline"
        label: string
      }
    > = {
      CONFIRMED: { variant: "default", label: "Confirmed" },
      PENDING: { variant: "secondary", label: "Pending Payment" },
      COMPLETED: { variant: "outline", label: "Completed" },
      CANCELLED: { variant: "destructive", label: "Cancelled" },
      NO_SHOW: { variant: "destructive", label: "No Show" },
    }

    const config = variants[status] || variants.PENDING
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const serviceNames = appointment.services
    .map((s) => s.service.name)
    .join(", ")

  return (
    <>
      <Card className={`${isPast ? "opacity-75" : ""} ${isNew ? "border-2 border-green-500 shadow-lg" : ""}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                {serviceNames}
                {isNew && (
                  <Badge variant="default" className="bg-green-600">
                    New
                  </Badge>
                )}
              </CardTitle>

              <CardDescription className="mt-2 flex items-center gap-1">
                <CalendarIcon size={14} />
                {format(new Date(appointment.startTime), "MMMM d, yyyy")} at{" "}
                {format(new Date(appointment.startTime), "h:mm a")}
              </CardDescription>
            </div>

            {getStatusBadge(appointment.status)}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <UserIcon size={16} className="mr-2" />
            With {appointment.staff.name}
          </div>

          <div className="flex items-center text-sm text-muted-foreground">
            <ClockIcon size={16} className="mr-2" />
            Duration: {totalDuration} minutes
          </div>

          <div className="flex items-center text-sm text-muted-foreground">
            <CurrencyDollarIcon size={16} className="mr-2" />
            Total Price: ${appointment.totalPrice.toFixed(2)}
          </div>

          {!isPast && (
            <>
              {appointment.depositPaid ? (
                <div className="mt-4 rounded-lg border-2 border-green-200 bg-green-50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon size={20} className="text-green-600" />
                    <div className="text-sm">
                      <p className="font-semibold text-green-900">
                        Deposit Paid: ${appointment.depositAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-lg border-2 border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center gap-2">
                    <WarningCircleIcon size={20} className="text-amber-600" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-900">
                        Payment Required: ${appointment.depositAmount.toFixed(2)}
                      </p>
                      <p className="text-amber-800">
                        Payments are currently disabled
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>

        {!isPast && appointment.status !== "CANCELLED" && (
          <CardFooter className="flex flex-col gap-3">
            {error && (
              <div className="w-full rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex w-full gap-2">
              {!appointment.depositPaid && (
                <Button
                  className="flex-1"
                  onClick={handlePayNow}
                  disabled={isPending}
                >
                  Payments Disabled
                </Button>
              )}

              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setRescheduleOpen(true)}
                disabled={isPending}
              >
                Reschedule
              </Button>

              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setCancelDialogOpen(true)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </CardFooter>
        )}

        {isPast && appointment.status === "COMPLETED" && (
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/">
                Book Again
              </Link>
            </Button>
          </CardFooter>
        )}
      </Card>

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        currentDate={new Date(appointment.startTime)}
        isPending={isPending}
        onSubmit={handleReschedule}
        availableSlots={availableSlots}
        loadingSlots={loadingSlots}
        onDateChange={handleDateChange}
      />

      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel Appointment"
        description="Are you sure you want to cancel this appointment?"
        confirmLabel="Cancel"
        cancelLabel="Keep"
        onConfirm={handleCancelAppointment}
        variant="destructive"
      />
    </>
  )
}