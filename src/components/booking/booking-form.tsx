"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  bookingSchema,
  authenticatedBookingSchema,
} from "@/lib/validations/booking"

import { createAppointment } from "@/app/actions/appointments"

import { ServiceStep } from "./steps/service-step"
import { ServiceSelectionStep } from "./steps/service-selection-step"
import { StaffStep } from "./steps/staff-step"
import { StaffDisplayStep } from "./steps/staff-display-step"
import { DateTimeStep } from "./steps/date-time-step"
import { CustomerInfoStep } from "./steps/customer-info-step"
import { BookingSummaryCard } from "./booking-summary-card"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { SparkleIcon } from "@/components/icons"

import { BookingFormProps, BookingFormValues } from "@/lib/interfaces"

export function BookingForm(props: BookingFormProps) {
  const {
    salonConfig,
    isAuthenticated,
    isEmployee,
    defaultValues = {},
  } = props

  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState("")

  const isStaffFirst = props.mode === "staff-first"

  const getSelectedService = () => {
    if (isStaffFirst) {
      return props.staffServices.find((s) => s.id === selectedServiceId)
    }
    return props.service
  }

  const selectedService = getSelectedService()

  const schema = isAuthenticated
    ? authenticatedBookingSchema
    : bookingSchema

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(schema) as never,
    mode: "onChange",
    defaultValues: {
      staffId: isStaffFirst ? props.preselectedStaff.id : "",
      date: undefined,
      time: "",
      firstName: defaultValues.firstName || "",
      lastName: defaultValues.lastName || "",
      email: defaultValues.email || "",
      phone: "",
      notes: "",
    },
  })

  const staffId = useWatch({ control, name: "staffId" })
  const selectedDate = useWatch({ control, name: "date" })
  const selectedTime = useWatch({ control, name: "time" })

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId)
  }

  const onSubmit = async (data: BookingFormValues) => {
    setSubmitting(true)
    setError(null)

    try {
      if (!data.date) {
        setError("Please select a date")
        setSubmitting(false)
        return
      }

      const serviceId = isStaffFirst
        ? selectedServiceId
        : props.service.id

      const [hours, minutes] = data.time.split(":").map(Number)
      const startTime = new Date(data.date)
      startTime.setHours(hours, minutes, 0, 0)

      // 🟢 Employee flow (direct booking, no payment)
      if (isEmployee) {
        const result = await createAppointment({
          serviceIds: [serviceId],
          staffId: data.staffId,
          startTime,
          guestPhone: data.phone || undefined,
          notes: data.notes || undefined,
          isEmployee: true,
        })

        if (result.success && result.appointmentId) {
          router.push(`/my-appointments?new=${result.appointmentId}`)
        } else {
          setError(result.error || "Failed to create appointment")
          setSubmitting(false)
        }
        return
      }

      // 🟢 Normal customer flow (NO STRIPE — direct booking)
      const result = await createAppointment({
        serviceIds: [serviceId],
        staffId: data.staffId,
        startTime,
        guestName: !isAuthenticated
          ? `${data.firstName} ${data.lastName}`
          : undefined,
        guestEmail: !isAuthenticated ? data.email : undefined,
        guestPhone: data.phone || undefined,
        notes: data.notes || undefined,
      })

      if (result.success && result.appointmentId) {
        router.push(`/my-appointments?new=${result.appointmentId}`)
      } else {
        setError(result.error || "Failed to create appointment")
        setSubmitting(false)
      }
    } catch (err) {
      console.error(err)
      setError("Unexpected error occurred")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {isEmployee && (
        <Alert className="mb-6">
          <SparkleIcon size={18} />
          <AlertDescription>
            Employee booking — 20% discount applied.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isStaffFirst ? (
            <>
              <StaffDisplayStep staff={props.preselectedStaff} />

              <ServiceSelectionStep
                services={props.staffServices}
                selectedServiceId={selectedServiceId}
                onSelectService={handleServiceSelect}
                error={
                  !selectedServiceId && error
                    ? "Please select a service"
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <ServiceStep service={props.service} />

              <StaffStep
                availableStaff={props.availableStaff}
                selectedStaffId={staffId}
                onSelectStaff={(id) =>
                  setValue("staffId", id, { shouldValidate: true })
                }
                error={errors.staffId?.message}
              />
            </>
          )}

          <DateTimeStep
            selectedStaffId={staffId}
            serviceDuration={selectedService?.duration || 60}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectDate={(date) =>
              setValue("date", date, { shouldValidate: true })
            }
            onSelectTime={(time) =>
              setValue("time", time, { shouldValidate: true })
            }
            maxBookingAdvance={salonConfig.maxBookingAdvance}
            dateError={errors.date?.message}
            timeError={errors.time?.message}
          />

          <CustomerInfoStep
            register={register}
            errors={errors}
            isAuthenticated={isAuthenticated}
          />
        </div>

        <div className="lg:col-span-1">
          <BookingSummaryCard
            service={selectedService || null}
            selectedStaff={
              isStaffFirst
                ? props.preselectedStaff
                : props.availableStaff.find((s) => s.id === staffId)
            }
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            salonConfig={salonConfig}
            submitting={submitting}
            error={error}
            isEmployee={isEmployee}
            availableSlots={[]}
          />
        </div>
      </div>
    </form>
  )
}