package payment

import (
	"net/http"
	"net/url"

	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/apperror"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/httpinput"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/identity"
	"github.com/Sukuna092main/sport-booking-system/backend/internal/platform/response"
	"github.com/gin-gonic/gin"
)

type Handler struct{ service *Service }

func NewHandler(service *Service) *Handler { return &Handler{service: service} }

func paymentActor(c *gin.Context) (string, bool) {
	a, ok := identity.Get(c)
	if !ok {
		response.Error(c, 401, "unauthorized", "Cần đăng nhập bằng token hợp lệ.")
		return "", false
	}
	return a.ID, true
}

func (h *Handler) StartCheckout(c *gin.Context) {
	owner, ok := paymentActor(c)
	if !ok {
		return
	}
	value, err := h.service.StartCheckout(c.Request.Context(), owner, c.Param("bookingId"), c.ClientIP())
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusCreated, value)
}

func (h *Handler) Status(c *gin.Context) {
	owner, ok := paymentActor(c)
	if !ok {
		return
	}
	value, err := h.service.Status(c.Request.Context(), owner, c.Param("bookingId"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}

func (h *Handler) CompleteMock(c *gin.Context) {
	owner, ok := paymentActor(c)
	if !ok {
		return
	}
	var input struct {
		Success bool `json:"success"`
	}
	if err := httpinput.JSON(c, &input); err != nil {
		apperror.Write(c, err)
		return
	}
	ack, err := h.service.CompleteMock(c.Request.Context(), owner, c.Param("orderRef"), input.Success)
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, ack)
}

func (h *Handler) VNPAYIPN(c *gin.Context) {
	ack := h.service.ProcessVNPAY(c.Request.Context(), c.Request.URL.Query())
	c.JSON(http.StatusOK, ack)
}

func (h *Handler) VNPAYReturn(c *gin.Context) {
	event, err := h.service.VerifyVNPAYReturn(c.Request.URL.Query())
	if err != nil {
		c.Redirect(http.StatusSeeOther, h.service.ReturnRedirect(GatewayEvent{OrderRef: "", ResponseCode: "invalid", TransactionStatus: ""}))
		return
	}
	c.Redirect(http.StatusSeeOther, h.service.ReturnRedirect(event))
}

func (h *Handler) GetPricing(c *gin.Context) {
	value, err := h.service.Pricing(c.Request.Context(), c.Param("courtId"))
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}

func (h *Handler) SetPricing(c *gin.Context) {
	actor, ok := paymentActor(c)
	if !ok {
		return
	}
	var body struct {
		PricePerSlotVND int64 `json:"pricePerSlotVnd"`
		IsActive        *bool `json:"isActive"`
	}
	if err := httpinput.JSON(c, &body); err != nil {
		apperror.Write(c, err)
		return
	}
	active := true
	if body.IsActive != nil {
		active = *body.IsActive
	}
	value, err := h.service.SetPricing(c.Request.Context(), c.Param("courtId"), actor, c.GetString("request_id"), Pricing{PricePerSlotVND: body.PricePerSlotVND, IsActive: active})
	if err != nil {
		apperror.Write(c, err)
		return
	}
	response.Data(c, http.StatusOK, value)
}

func ParseReturnQuery(raw string) url.Values { values, _ := url.ParseQuery(raw); return values }
